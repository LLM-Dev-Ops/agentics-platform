/**
 * Request Lifecycle Handler
 * Implements SPARC handleRequest pseudocode exactly
 * Main request processing logic for API Gateway
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { extractCredentials, validateCredentials, AuthContext, Identity } from '../middleware/auth.js';
import { isRateLimited } from '../middleware/rate-limit.js';
import { getRequiredScope, hasScope } from '../middleware/scope.js';
import { routeToCore, forwardRequest, streamResponse, getRequestPath, isStreamingEndpoint } from '../router/index.js';
import { createErrorResponse } from '../server.js';
import {
  enterpriseBoundaryMiddleware,
  dataRetentionMiddleware,
  onSimulationStart,
  onSimulationComplete,
  type UpgradeRequiredError,
} from '../middleware/enterprise-boundary.js';

export interface UsageRecord {
  correlationId: string;
  orgId: string;
  keyId: string;
  endpoint: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'in_progress' | 'completed' | 'failed';
  responseStatus?: number;
  tokensUsed?: number;
}

export interface MetricsPayload {
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  correlationId: string;
  orgId: string;
  keyId: string;
}

/**
 * Main request handler implementing SPARC pseudocode
 * FUNCTION handleRequest(request)
 */
export async function handleRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // correlationId = generateUUID()
  const correlationId = request.id || uuidv4();

  // attachCorrelationId(request, correlationId)
  reply.header('X-Request-Id', correlationId);

  // startTime = now()
  const startTime = Date.now();

  try {
    // credentials = extractCredentials(request)
    const credentials = extractCredentials(request);

    // result = validateCredentials(credentials)
    const result = await validateCredentials(credentials);

    // IF result IS NULL: RETURN errorResponse(401, "AUTHENTICATION_REQUIRED", correlationId)
    if (!result) {
      const error = createErrorResponse(
        401,
        'AUTHENTICATION_REQUIRED',
        'Valid API key required. Use Authorization: Bearer <api_key>',
        correlationId
      );
      return reply.status(error.statusCode).send(error.response);
    }

    const { auth, identity } = result;

    // endpoint = parseEndpoint(request.path)
    const endpoint = `${request.method} ${getRequestPath(request.url)}`;

    // requiredScope = getRequiredScope(endpoint)
    const requiredScope = getRequiredScope(endpoint);

    // IF NOT hasScope(auth, requiredScope): RETURN errorResponse(403, "AUTHORIZATION_DENIED", correlationId)
    if (!hasScope(auth, requiredScope)) {
      const error = createErrorResponse(
        403,
        'AUTHORIZATION_DENIED',
        'Insufficient permissions for this operation',
        correlationId,
        {
          requiredScope,
          keyScopes: auth.scopes,
        }
      );
      return reply.status(error.statusCode).send(error.response);
    }

    // IF isRateLimited(identity, endpoint): RETURN errorResponse(429, "RATE_LIMIT_EXCEEDED", correlationId)
    const rateLimitResult = isRateLimited(identity, getRequestPath(request.url));

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', rateLimitResult.limit.toString());
    reply.header('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    reply.header('X-RateLimit-Reset', rateLimitResult.resetAt.toString());

    if (rateLimitResult.limited) {
      reply.header('Retry-After', rateLimitResult.retryAfter!.toString());
      const error = createErrorResponse(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Request rate limit exceeded',
        correlationId,
        {
          limit: rateLimitResult.limit,
          retryAfter: rateLimitResult.retryAfter,
          resetAt: rateLimitResult.resetAt,
        }
      );
      return reply.status(error.statusCode).send(error.response);
    }

    // ========================================================================
    // ENTERPRISE BOUNDARY CHECK
    // Enforces hard limits for non-enterprise organizations.
    // Must run BEFORE any business logic or resource creation.
    // ========================================================================

    // Attach auth to request for enterprise boundary middleware
    request.auth = auth;

    // Check enterprise limits (simulation limits, CI/CD blocking, etc.)
    // This will return early with UPGRADE_REQUIRED if limits exceeded
    const enterpriseCheckResult = await checkEnterpriseBoundary(request, reply, auth);
    if (enterpriseCheckResult.blocked) {
      return; // Response already sent by middleware
    }

    // Track simulation run if this is a simulation request
    let simulationRunId: string | undefined;
    const path = getRequestPath(request.url);

    if (request.method === 'POST' && path === '/v1/simulate') {
      simulationRunId = onSimulationStart(auth.org_id);
      // Store for later completion tracking
      storeSimulationRunId(correlationId, simulationRunId);
    }

    // Check data retention for historical data requests
    const dataRetentionResult = await checkDataRetention(request, reply, auth);
    if (dataRetentionResult.blocked) {
      return; // Response already sent
    }

    // ========================================================================

    // recordUsageStart(auth, endpoint, correlationId)
    recordUsageStart(auth, endpoint, correlationId);

    // layer3Core = routeToCore(endpoint)
    const layer3Core = routeToCore(path);

    if (!layer3Core) {
      const error = createErrorResponse(
        404,
        'NOT_FOUND',
        'Endpoint not found',
        correlationId
      );
      return reply.status(error.statusCode).send(error.response);
    }

    // response = forwardRequest(layer3Core, request, correlationId)
    // Pass org_id to Layer 3 for context (backwards compatible with userId)
    const upstreamResponse = await forwardRequest(layer3Core, {
      method: request.method,
      path: request.url,
      headers: request.headers as Record<string, string>,
      body: request.body,
      correlationId,
      userId: auth.org_id, // Pass org_id as userId for Layer 3 compatibility
      scopes: auth.scopes,
    });

    // Handle streaming responses
    if (upstreamResponse.streaming && upstreamResponse.body instanceof ReadableStream) {
      // For streaming, we record usage end after stream completes
      // This is a simplified version - production would track streaming metrics differently
      recordUsageEnd(auth, endpoint, correlationId, {
        status: upstreamResponse.status,
      });

      return streamResponse(reply, upstreamResponse.body);
    }

    // recordUsageEnd(auth, endpoint, correlationId, response)
    recordUsageEnd(auth, endpoint, correlationId, upstreamResponse);

    // Complete simulation run tracking (releases concurrent run slot)
    if (simulationRunId) {
      completeSimulationRun(correlationId, auth.org_id);
    }

    // emitMetrics(endpoint, startTime, response.status)
    emitMetrics({
      endpoint: path,
      method: request.method,
      statusCode: upstreamResponse.status,
      durationMs: Date.now() - startTime,
      correlationId,
      orgId: auth.org_id,
      keyId: auth.key_id,
    });

    // RETURN response
    return reply.status(upstreamResponse.status).send(upstreamResponse.body);

  } catch (error) {
    // CATCH error:
    // emitErrorMetric(endpoint, error)
    emitErrorMetric(getRequestPath(request.url), error);

    // Clean up any in-flight simulation tracking
    // Note: We can lookup from store even without auth context
    const runId = simulationRunStore.get(correlationId);
    if (runId && request.auth) {
      onSimulationComplete(request.auth.org_id, runId);
      simulationRunStore.delete(correlationId);
    }

    // RETURN errorResponse(500, "INTERNAL_ERROR", correlationId)
    const errorResponse = createErrorResponse(
      500,
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'An unexpected error occurred',
      correlationId
    );
    return reply.status(errorResponse.statusCode).send(errorResponse.response);
  }
}

/**
 * Record usage start
 * FUNCTION recordUsageStart(auth, endpoint, correlationId)
 */
function recordUsageStart(auth: AuthContext, endpoint: string, correlationId: string): void {
  const usageRecord: UsageRecord = {
    correlationId,
    orgId: auth.org_id,
    keyId: auth.key_id,
    endpoint,
    startTime: Date.now(),
    status: 'in_progress',
  };

  storeUsageRecord(usageRecord);
}

/**
 * Record usage end
 * FUNCTION recordUsageEnd(auth, endpoint, correlationId, response)
 */
function recordUsageEnd(
  auth: AuthContext,
  endpoint: string,
  correlationId: string,
  response: { status: number; body?: unknown }
): void {
  const usageRecord = lookupUsageRecord(correlationId);

  if (usageRecord) {
    usageRecord.endTime = Date.now();
    usageRecord.durationMs = usageRecord.endTime - usageRecord.startTime;
    usageRecord.status = 'completed';
    usageRecord.responseStatus = response.status;
    usageRecord.tokensUsed = extractTokenUsage(response);

    storeUsageRecord(usageRecord);
    incrementUsageCounters(auth.org_id, auth.key_id, endpoint, usageRecord);
  }
}

/**
 * Extract token usage from response
 */
function extractTokenUsage(response: { body?: unknown }): number | undefined {
  if (typeof response.body === 'object' && response.body !== null) {
    const body = response.body as Record<string, unknown>;

    // Check for common token usage fields
    if (body.usage && typeof body.usage === 'object') {
      const usage = body.usage as Record<string, unknown>;

      if (typeof usage.total_tokens === 'number') {
        return usage.total_tokens;
      }

      const promptTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
      const completionTokens = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;

      if (promptTokens || completionTokens) {
        return promptTokens + completionTokens;
      }
    }
  }

  return undefined;
}

/**
 * Emit metrics
 */
function emitMetrics(payload: MetricsPayload): void {
  // MVP: Log metrics
  // Production: Send to metrics backend (Prometheus, Datadog, etc.)
  console.log('[METRIC]', JSON.stringify(payload));
}

/**
 * Emit error metric
 */
function emitErrorMetric(endpoint: string, error: unknown): void {
  // MVP: Log error metric
  // Production: Send to metrics backend
  console.error('[ERROR_METRIC]', {
    endpoint,
    error: error instanceof Error ? error.message : String(error),
    timestamp: Date.now(),
  });
}

/**
 * Increment usage counters
 */
function incrementUsageCounters(orgId: string, keyId: string, endpoint: string, record: UsageRecord): void {
  // MVP: Log usage increment
  // Production: Update usage database and quotas
  console.log('[USAGE]', {
    orgId,
    keyId,
    endpoint,
    tokensUsed: record.tokensUsed,
    durationMs: record.durationMs,
  });
}

// ============================================================================
// In-Memory Store for MVP
// Production: Replace with database
// ============================================================================

const usageStore = new Map<string, UsageRecord>();

function storeUsageRecord(record: UsageRecord): void {
  usageStore.set(record.correlationId, record);
}

function lookupUsageRecord(correlationId: string): UsageRecord | undefined {
  return usageStore.get(correlationId);
}

// ============================================================================
// Enterprise Boundary Helpers
// ============================================================================

interface EnterpriseBoundaryResult {
  blocked: boolean;
}

/**
 * Check enterprise boundary limits
 * Returns blocked: true if request should be rejected
 */
async function checkEnterpriseBoundary(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: AuthContext
): Promise<EnterpriseBoundaryResult> {
  // Create a mock reply that captures whether a response was sent
  let responseSent = false;
  const originalSend = reply.send.bind(reply);
  const originalStatus = reply.status.bind(reply);

  // Track if enterprise middleware sends a response
  const mockReply = {
    ...reply,
    status: (code: number) => {
      originalStatus(code);
      return {
        send: (body: unknown) => {
          responseSent = true;
          return originalSend(body);
        },
      };
    },
    send: (body: unknown) => {
      responseSent = true;
      return originalSend(body);
    },
  } as FastifyReply;

  await enterpriseBoundaryMiddleware(request, mockReply);

  return { blocked: responseSent };
}

/**
 * Check data retention limits for historical data requests
 * Returns blocked: true if request should be rejected
 */
async function checkDataRetention(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: AuthContext
): Promise<EnterpriseBoundaryResult> {
  const path = getRequestPath(request.url);

  // Only check data retention for data access routes
  const dataAccessRoutes = [
    '/v1/simulate',
    '/v1/data/',
    '/v1/usage/history',
    '/v1/simulations',
  ];

  const isDataAccessRoute = dataAccessRoutes.some(route => path.startsWith(route));

  if (!isDataAccessRoute || request.method !== 'GET') {
    return { blocked: false };
  }

  // Create a mock reply that captures whether a response was sent
  let responseSent = false;
  const originalSend = reply.send.bind(reply);
  const originalStatus = reply.status.bind(reply);

  const mockReply = {
    ...reply,
    status: (code: number) => {
      originalStatus(code);
      return {
        send: (body: unknown) => {
          responseSent = true;
          return originalSend(body);
        },
      };
    },
    send: (body: unknown) => {
      responseSent = true;
      return originalSend(body);
    },
  } as FastifyReply;

  await dataRetentionMiddleware(request, mockReply);

  return { blocked: responseSent };
}

// Store simulation run IDs for completion tracking
const simulationRunStore = new Map<string, string>(); // correlationId -> runId

/**
 * Store simulation run ID for later completion tracking
 */
export function storeSimulationRunId(correlationId: string, runId: string): void {
  simulationRunStore.set(correlationId, runId);
}

/**
 * Complete and clean up simulation tracking
 */
export function completeSimulationRun(correlationId: string, orgId: string): void {
  const runId = simulationRunStore.get(correlationId);
  if (runId) {
    onSimulationComplete(orgId, runId);
    simulationRunStore.delete(correlationId);
  }
}
