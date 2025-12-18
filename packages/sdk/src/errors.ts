/**
 * Base error class for all Agentics SDK errors
 */
export class AgenticsError extends Error {
  public readonly code: string;
  public readonly requestId?: string;

  constructor(message: string, code: string, requestId?: string) {
    super(message);
    this.name = 'AgenticsError';
    this.code = code;
    this.requestId = requestId;
    Object.setPrototypeOf(this, AgenticsError.prototype);
  }
}

/**
 * Authentication error - invalid or missing API key
 */
export class AuthenticationError extends AgenticsError {
  constructor(message: string, requestId?: string) {
    super(message, 'authentication_error', requestId);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization error - insufficient permissions
 */
export class AuthorizationError extends AgenticsError {
  constructor(message: string, requestId?: string) {
    super(message, 'authorization_error', requestId);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends AgenticsError {
  public readonly retryAfter?: number;

  constructor(message: string, requestId?: string, retryAfter?: number) {
    super(message, 'rate_limit_error', requestId);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Quota exceeded error - usage limits reached
 */
export class QuotaExceededError extends AgenticsError {
  constructor(message: string, requestId?: string) {
    super(message, 'quota_exceeded_error', requestId);
    this.name = 'QuotaExceededError';
    Object.setPrototypeOf(this, QuotaExceededError.prototype);
  }
}

/**
 * Invalid request error - validation failed
 */
export class InvalidRequestError extends AgenticsError {
  public readonly field?: string;

  constructor(message: string, requestId?: string, field?: string) {
    super(message, 'invalid_request_error', requestId);
    this.name = 'InvalidRequestError';
    this.field = field;
    Object.setPrototypeOf(this, InvalidRequestError.prototype);
  }
}

/**
 * Upstream error - error from upstream service
 */
export class UpstreamError extends AgenticsError {
  constructor(message: string, requestId?: string) {
    super(message, 'upstream_error', requestId);
    this.name = 'UpstreamError';
    Object.setPrototypeOf(this, UpstreamError.prototype);
  }
}

/**
 * API error response structure
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    field?: string;
    requestId?: string;
  };
}

/**
 * Parse API error response and create appropriate error instance
 */
export function createErrorFromResponse(
  response: ErrorResponse,
  status: number,
  retryAfter?: number
): AgenticsError {
  const { code, message, field, requestId } = response.error;

  switch (code) {
    case 'authentication_error':
      return new AuthenticationError(message, requestId);
    case 'authorization_error':
      return new AuthorizationError(message, requestId);
    case 'rate_limit_error':
      return new RateLimitError(message, requestId, retryAfter);
    case 'quota_exceeded_error':
      return new QuotaExceededError(message, requestId);
    case 'invalid_request_error':
      return new InvalidRequestError(message, requestId, field);
    case 'upstream_error':
      return new UpstreamError(message, requestId);
    default:
      return new AgenticsError(message, code, requestId);
  }
}
