/**
 * RuVector Client Errors
 */

/**
 * Base error for ruvector-client
 */
export class RuvectorError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RuvectorError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Connection error
 */
export class RuvectorConnectionError extends RuvectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONNECTION_ERROR', undefined, details);
    this.name = 'RuvectorConnectionError';
  }
}

/**
 * Authentication error
 */
export class RuvectorAuthError extends RuvectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'RuvectorAuthError';
  }
}

/**
 * Not found error
 */
export class RuvectorNotFoundError extends RuvectorError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404, { resource, id });
    this.name = 'RuvectorNotFoundError';
  }
}

/**
 * Validation error
 */
export class RuvectorValidationError extends RuvectorError {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string }>
  ) {
    super(message, 'VALIDATION_ERROR', 400, { validationErrors });
    this.name = 'RuvectorValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Rate limit error
 */
export class RuvectorRateLimitError extends RuvectorError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter}ms`, 'RATE_LIMIT', 429, {
      retryAfter,
    });
    this.name = 'RuvectorRateLimitError';
    this.retryAfter = retryAfter;
  }
}
