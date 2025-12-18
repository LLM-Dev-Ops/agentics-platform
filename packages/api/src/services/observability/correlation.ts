/**
 * Correlation ID management for request tracing
 *
 * Generates and manages correlation IDs to track requests across services.
 * Correlation IDs are propagated through:
 * - X-Request-Id header (external to client)
 * - X-Correlation-Id header (internal to Layer 3)
 */

import { randomUUID } from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';

const CORRELATION_ID_HEADER = 'x-request-id';
const INTERNAL_CORRELATION_HEADER = 'x-correlation-id';

/**
 * Generate a new correlation ID using UUIDv4
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Attach correlation ID to a request object
 * Stores it in request.headers for downstream propagation
 */
export function attachCorrelationId(
  request: FastifyRequest,
  correlationId: string
): void {
  // Store in request context (Fastify-specific)
  (request as any).correlationId = correlationId;

  // Also store in headers for easy access
  request.headers[CORRELATION_ID_HEADER] = correlationId;
}

/**
 * Get correlation ID from a request
 * Returns existing ID or generates a new one
 */
export function getCorrelationId(request: FastifyRequest): string {
  // Check if already attached
  const existing = (request as any).correlationId;
  if (existing) {
    return existing;
  }

  // Check headers for existing ID (from upstream)
  const headerValue =
    request.headers[CORRELATION_ID_HEADER] ||
    request.headers[INTERNAL_CORRELATION_HEADER];

  if (headerValue) {
    const id = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    attachCorrelationId(request, id);
    return id;
  }

  // Generate new ID
  const newId = generateCorrelationId();
  attachCorrelationId(request, newId);
  return newId;
}

/**
 * Fastify hook to add correlation ID to all responses
 * Attaches X-Request-Id header to response
 */
export function correlationIdHook() {
  return {
    onRequest: async (request: FastifyRequest, reply: FastifyReply) => {
      // Ensure correlation ID is generated/attached
      const correlationId = getCorrelationId(request);

      // Add to response headers
      reply.header(CORRELATION_ID_HEADER, correlationId);
    },
  };
}

/**
 * Get headers to propagate to Layer 3 requests
 * Includes correlation ID as X-Correlation-Id
 */
export function getLayer3Headers(request: FastifyRequest): {
  [key: string]: string;
} {
  const correlationId = getCorrelationId(request);

  return {
    [INTERNAL_CORRELATION_HEADER]: correlationId,
  };
}

/**
 * Create a correlation context for logging
 * Returns object with correlation ID for structured logging
 */
export function getCorrelationContext(request: FastifyRequest): {
  correlationId: string;
} {
  return {
    correlationId: getCorrelationId(request),
  };
}
