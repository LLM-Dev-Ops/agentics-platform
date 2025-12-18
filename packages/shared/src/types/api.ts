/**
 * API Types for Layer 4 Agentics Platform
 *
 * Standard error responses, error codes, and request/response types
 * for all API endpoints as defined in the SPARC specification.
 */

/**
 * Standard error response structure returned by all API endpoints
 */
export interface ErrorResponse {
  /** Human-readable error message */
  error: string;
  /** Machine-readable error code for programmatic handling */
  code: string;
  /** Unique identifier for this request, useful for debugging and support */
  request_id: string;
  /** Optional additional context about the error */
  details?: Record<string, unknown>;
}

/**
 * Standard error codes used across the platform
 */
export enum ErrorCode {
  /** Authentication credentials are missing or invalid */
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  /** User lacks permission to access this resource */
  AUTHORIZATION_DENIED = 'AUTHORIZATION_DENIED',
  /** Rate limit exceeded for this endpoint */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  /** Monthly quota exceeded for this resource */
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  /** Request validation failed */
  INVALID_REQUEST = 'INVALID_REQUEST',
  /** Error from upstream service (Layer 3) */
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  /** Service temporarily unavailable */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Standard pagination parameters
 */
export interface PaginationParams {
  /** Number of items per page */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Standard pagination metadata in responses
 */
export interface PaginationMeta {
  /** Total number of items available */
  total: number;
  /** Current page limit */
  limit: number;
  /** Current page offset */
  offset: number;
  /** Whether there are more items available */
  has_more: boolean;
}

/**
 * Health check response
 */
export interface HealthResponse {
  /** Service status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** ISO 8601 timestamp */
  timestamp: string;
  /** API version */
  version: string;
  /** Layer 3 core statuses */
  cores?: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
}

/**
 * Standard success response wrapper
 */
export interface SuccessResponse<T = unknown> {
  /** Response data */
  data: T;
  /** Request identifier */
  request_id: string;
  /** Response metadata (e.g., pagination) */
  meta?: Record<string, unknown>;
}
