/**
 * Observability Middleware - Automatic observability for all requests
 *
 * Fastify hooks that automatically:
 * - Generate/propagate correlation IDs
 * - Record request metrics
 * - Emit usage events
 * - Track errors
 *
 * This middleware is registered globally on the Fastify instance.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getObservabilityService,
  getCorrelationId,
} from '../services/observability/index.js';

// Store request start times
const requestStartTimes = new WeakMap<FastifyRequest, number>();

/**
 * Register observability hooks on Fastify instance
 */
export function registerObservabilityMiddleware(app: FastifyInstance): void {
  // onRequest: Set up correlation ID and record start time
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Generate or extract correlation ID
    const correlationId = getCorrelationId(request);

    // Add correlation ID to response headers
    reply.header('x-request-id', correlationId);

    // Record request start time
    requestStartTimes.set(request, Date.now());
  });

  // onResponse: Record metrics and usage
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = requestStartTimes.get(request);
    if (!startTime) {
      return; // Should not happen, but guard against it
    }

    const duration = Date.now() - startTime;
    const correlationId = getCorrelationId(request);

    // Extract request information
    const endpoint = getNormalizedEndpoint(request);
    const status = reply.statusCode;
    const requestSize = getRequestSize(request);
    const responseSize = getResponseSize(reply);

    // Get user ID from request context (set by auth middleware)
    const userId = getUserId(request);

    // Get token count if available (set by Layer 3 proxy)
    const tokens = getTokenCount(request);

    const observability = getObservabilityService();

    // Record the request (metrics + usage)
    if (userId) {
      observability.recordRequest({
        userId,
        endpoint,
        status,
        duration,
        requestSize,
        responseSize,
        tokens,
        correlationId,
        metadata: {
          method: request.method,
          status,
        },
      });
    } else {
      // No user ID - only record metrics (e.g., health checks, metrics endpoint)
      observability.metrics.emitRequestMetric(
        endpoint,
        status,
        duration / 1000, // Convert to seconds
        requestSize,
        responseSize
      );
    }

    // Clean up
    requestStartTimes.delete(request);
  });

  // onError: Record error metrics
  app.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const endpoint = getNormalizedEndpoint(request);
    const correlationId = getCorrelationId(request);

    // Map error to error code
    const errorCode = getErrorCode(error, reply);

    const observability = getObservabilityService();

    observability.recordError({
      endpoint,
      errorCode,
      correlationId,
    });
  });
}

/**
 * Get normalized endpoint path (remove dynamic segments for aggregation)
 */
function getNormalizedEndpoint(request: FastifyRequest): string {
  const path = request.url.split('?')[0]; // Remove query string

  // Normalize common patterns:
  // /api/keys/key_abc123 -> /api/keys/:id
  // /api/users/user_xyz789 -> /api/users/:id

  let normalized = path;

  // Replace UUIDs
  normalized = normalized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );

  // Replace key IDs (key_*)
  normalized = normalized.replace(/\/key_[a-zA-Z0-9]+/g, '/:keyId');

  // Replace user IDs (user_*)
  normalized = normalized.replace(/\/user_[a-zA-Z0-9]+/g, '/:userId');

  // Replace numeric IDs
  normalized = normalized.replace(/\/\d+/g, '/:id');

  return normalized;
}

/**
 * Get user ID from request context
 * Set by authentication middleware
 */
function getUserId(request: FastifyRequest): string | undefined {
  // Try to get from request context (set by auth middleware)
  const user = (request as any).user;
  if (user?.id) {
    return user.id;
  }

  // Try to get from authenticated user
  if (user?.userId) {
    return user.userId;
  }

  return undefined;
}

/**
 * Get token count from request context
 * Set by Layer 3 proxy after LLM completion
 */
function getTokenCount(request: FastifyRequest): number | undefined {
  const tokens = (request as any).tokens;
  return typeof tokens === 'number' ? tokens : undefined;
}

/**
 * Estimate request size in bytes
 */
function getRequestSize(request: FastifyRequest): number {
  // Get content-length header if available
  const contentLength = request.headers['content-length'];
  if (contentLength) {
    return parseInt(contentLength, 10);
  }

  // Estimate from body if available
  if (request.body) {
    try {
      return JSON.stringify(request.body).length;
    } catch (e) {
      return 0;
    }
  }

  return 0;
}

/**
 * Estimate response size in bytes
 */
function getResponseSize(reply: FastifyReply): number {
  // Get content-length header if set
  const contentLength = reply.getHeader('content-length');
  if (contentLength) {
    return typeof contentLength === 'string'
      ? parseInt(contentLength, 10)
      : Array.isArray(contentLength)
      ? parseInt(contentLength[0], 10)
      : 0;
  }

  // For MVP, return 0 if not available
  // In production, this would be captured from the actual response
  return 0;
}

/**
 * Map error to error code
 */
function getErrorCode(error: Error, reply: FastifyReply): string {
  // Check if error has a code property
  const errorWithCode = error as any;
  if (errorWithCode.code) {
    return errorWithCode.code;
  }

  // Check if error has a statusCode property
  if (errorWithCode.statusCode) {
    return `HTTP_${errorWithCode.statusCode}`;
  }

  // Check reply status code
  const statusCode = reply.statusCode;
  if (statusCode >= 400) {
    return `HTTP_${statusCode}`;
  }

  // Default to error name
  return error.name || 'UNKNOWN_ERROR';
}

/**
 * Middleware to attach user context to request
 * Call this after authentication to make user ID available to observability
 */
export function attachUserContext(
  request: FastifyRequest,
  userId: string
): void {
  (request as any).user = { id: userId, userId };
}

/**
 * Middleware to attach token count to request
 * Call this after Layer 3 proxy returns token usage
 */
export function attachTokenCount(
  request: FastifyRequest,
  tokens: number
): void {
  (request as any).tokens = tokens;
}
