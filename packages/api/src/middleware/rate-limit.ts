/**
 * Rate Limiting Middleware
 * Implements sliding window rate limiting per SPARC pseudocode
 * MVP: In-memory Map (production should use Redis)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { Identity } from './auth.js';
import config from '../config.js';

export interface RateWindow {
  startTime: number;
  count: number;
}

export interface RateLimitResult {
  limited: boolean;
  retryAfter?: number;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Get current rate window timestamp (start of window)
 */
function getCurrentRateWindow(): number {
  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  return Math.floor(now / windowMs) * windowMs;
}

/**
 * Format rate limit key for storage
 */
function formatRateKey(userId: string, endpoint: string, window: number): string {
  return `${userId}:${endpoint}:${window}`;
}

/**
 * Get rate limit for user based on entitlements
 */
function getEntitlementLimit(identity: Identity, endpoint: string): number {
  // Base rate limits by plan
  const planLimits = {
    free: 10,        // 10 requests per minute
    developer: 100,  // 100 requests per minute
    team: 1000,      // 1000 requests per minute
    enterprise: 10000, // 10000 requests per minute
  };

  return planLimits[identity.entitlements.plan] || planLimits.free;
}

/**
 * Get current rate count for a key
 */
function getRateCount(key: string): number {
  const rateStore = getRateLimitStore();
  const window = rateStore.get(key);

  if (!window) {
    return 0;
  }

  // Check if window is still valid
  const now = Date.now();
  const windowAge = now - window.startTime;

  if (windowAge > config.rateLimit.windowMs) {
    // Window expired, remove it
    rateStore.delete(key);
    return 0;
  }

  return window.count;
}

/**
 * Increment rate count for a key
 */
function incrementRateCount(key: string): void {
  const rateStore = getRateLimitStore();
  const window = rateStore.get(key);
  const now = Date.now();

  if (!window) {
    rateStore.set(key, {
      startTime: now,
      count: 1,
    });
  } else {
    window.count++;
    rateStore.set(key, window);
  }
}

/**
 * Check if request is rate limited
 * Implements SPARC isRateLimited pseudocode
 */
export function isRateLimited(identity: Identity, endpoint: string): RateLimitResult {
  const window = getCurrentRateWindow();
  const key = formatRateKey(identity.userId, endpoint, window);

  const currentCount = getRateCount(key);
  const limit = getEntitlementLimit(identity, endpoint);

  if (currentCount >= limit) {
    const resetAt = window + config.rateLimit.windowMs;
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000); // seconds

    return {
      limited: true,
      retryAfter,
      limit,
      remaining: 0,
      resetAt,
    };
  }

  incrementRateCount(key);

  return {
    limited: false,
    limit,
    remaining: limit - currentCount - 1,
    resetAt: window + config.rateLimit.windowMs,
  };
}

/**
 * Rate limiting middleware for Fastify
 */
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const identity = request.identity;

  if (!identity) {
    // No identity means auth middleware should have rejected
    // This is a fallback
    reply.status(401).send({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      request_id: request.id,
    });
    return;
  }

  // Extract endpoint path (normalize to domain path like /v1/intelligence/*)
  const endpoint = normalizeEndpoint(request.url);

  const result = isRateLimited(identity, endpoint);

  // Add rate limit headers
  reply.header('X-RateLimit-Limit', result.limit.toString());
  reply.header('X-RateLimit-Remaining', result.remaining.toString());
  reply.header('X-RateLimit-Reset', result.resetAt.toString());

  if (result.limited) {
    reply.header('Retry-After', result.retryAfter!.toString());
    reply.status(429).send({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      request_id: request.id,
      details: {
        limit: result.limit,
        retryAfter: result.retryAfter,
        resetAt: result.resetAt,
      },
    });
    return;
  }
}

/**
 * Normalize endpoint path to domain path
 * Examples:
 *   /v1/intelligence/completions -> /v1/intelligence
 *   /v1/security/scan -> /v1/security
 */
function normalizeEndpoint(url: string): string {
  // Remove query parameters
  const path = url.split('?')[0];

  // Extract up to third segment (e.g., /v1/intelligence)
  const segments = path.split('/').filter(s => s.length > 0);

  if (segments.length >= 2) {
    return `/${segments[0]}/${segments[1]}`;
  }

  return path;
}

/**
 * Clean up expired rate limit windows
 * Should be called periodically in production
 */
export function cleanupExpiredWindows(): void {
  const rateStore = getRateLimitStore();
  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;

  for (const [key, window] of rateStore.entries()) {
    const windowAge = now - window.startTime;
    if (windowAge > windowMs * 2) {
      // Delete windows that are more than 2x the window size old
      rateStore.delete(key);
    }
  }
}

// ============================================================================
// In-Memory Store for MVP
// Production: Replace with Redis
// ============================================================================

const rateLimitStore = new Map<string, RateWindow>();

function getRateLimitStore(): Map<string, RateWindow> {
  return rateLimitStore;
}

// Cleanup expired windows every 5 minutes
setInterval(cleanupExpiredWindows, 5 * 60 * 1000);
