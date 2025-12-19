/**
 * Request Lifecycle Handler
 * Implements SPARC handleRequest pseudocode exactly
 * Main request processing logic for API Gateway
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { extractCredentials, validateCredentials, Identity } from '../middleware/auth.js';
import { isRateLimited } from '../middleware/rate-limit.js';
import { getRequiredScope, hasScope } from '../middleware/scope.js';
import { routeToCore, forwardRequest, streamResponse, getRequestPath, isStreamingEndpoint } from '../router/index.js';
import { createErrorResponse } from '../server.js';

export interface UsageRecord {
  correlationId: string;
  userId: string;
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
  userId: string;
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

    // identity = validateCredentials(credentials)
    const identity = await validateCredentials(credentials);

    // IF identity IS NULL: RETURN errorResponse(401, "AUTHENTICATION_REQUIRED", correlationId)
    if (!identity) {
      const error = createErrorResponse(
        401,
        'AUTHENTICATION_REQUIRED',
        'Valid authentication credentials are required',
        correlationId
      );
      return reply.status(error.statusCode).send(error.response);
    }

    // endpoint = parseEndpoint(request.path)
    const endpoint = `${request.method} ${getRequestPath(request.url)}`;

    // requiredScope = getRequiredScope(endpoint)
    const requiredScope = getRequiredScope(endpoint);

    // IF NOT hasScope(identity, requiredScope): RETURN errorResponse(403, "AUTHORIZATION_DENIED", correlationId)
    if (!hasScope(identity, requiredScope)) {
      const error = createErrorResponse(
        403,
        'AUTHORIZATION_DENIED',
        'Insufficient permissions for this operation',
        correlationId,
        {
          requiredScope,
          userScopes: identity.scopes,
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

    // recordUsageStart(identity, endpoint, correlationId)
    recordUsageStart(identity, endpoint, correlationId);

    // layer3Core = routeToCore(endpoint)
    const path = getRequestPath(request.url);
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
    const upstreamResponse = await forwardRequest(layer3Core, {
      method: request.method,
      path: request.url,
      headers: request.headers as Record<string, string>,
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    // Handle streaming responses
    if (upstreamResponse.streaming && upstreamResponse.body instanceof ReadableStream) {
      // For streaming, we record usage end after stream completes
      // This is a simplified version - production would track streaming metrics differently
      recordUsageEnd(identity, endpoint, correlationId, {
        status: upstreamResponse.status,
      });

      return streamResponse(reply, upstreamResponse.body);
    }

    // recordUsageEnd(identity, endpoint, correlationId, response)
    recordUsageEnd(identity, endpoint, correlationId, upstreamResponse);

    // emitMetrics(endpoint, startTime, response.status)
    emitMetrics({
      endpoint: path,
      method: request.method,
      statusCode: upstreamResponse.status,
      durationMs: Date.now() - startTime,
      correlationId,
      userId: identity.userId,
    });

    // RETURN response
    return reply.status(upstreamResponse.status).send(upstreamResponse.body);

  } catch (error) {
    // CATCH error:
    // emitErrorMetric(endpoint, error)
    emitErrorMetric(getRequestPath(request.url), error);

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
 * FUNCTION recordUsageStart(identity, endpoint, correlationId)
 */
function recordUsageStart(identity: Identity, endpoint: string, correlationId: string): void {
  const usageRecord: UsageRecord = {
    correlationId,
    userId: identity.userId,
    endpoint,
    startTime: Date.now(),
    status: 'in_progress',
  };

  storeUsageRecord(usageRecord);
}

/**
 * Record usage end
 * FUNCTION recordUsageEnd(identity, endpoint, correlationId, response)
 */
function recordUsageEnd(
  identity: Identity,
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
    incrementUsageCounters(identity.userId, endpoint, usageRecord);
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
function incrementUsageCounters(userId: string, endpoint: string, record: UsageRecord): void {
  // MVP: Log usage increment
  // Production: Update usage database and quotas
  console.log('[USAGE]', {
    userId,
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
