/**
 * Validation Utilities
 *
 * Common validation functions for contract enforcement.
 */

import { createHash } from 'crypto';
import { z } from 'zod';

/**
 * Compute SHA-256 hash of inputs for determinism verification
 */
export function computeInputsHash(inputs: unknown): string {
  const normalized = JSON.stringify(inputs, Object.keys(inputs as object).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Validate UUID format
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate semantic version format
 */
export function isValidSemVer(value: string): boolean {
  const semverRegex = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i;
  return semverRegex.test(value);
}

/**
 * Validate ISO 8601 datetime
 */
export function isValidDateTime(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime()) && value === date.toISOString();
}

/**
 * Create validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Extract validation errors from Zod error
 */
export function extractValidationErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map(e => ({
    field: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));
}

/**
 * Assert condition or throw validation error
 */
export function assertValid(
  condition: boolean,
  field: string,
  message: string,
  code: string = 'VALIDATION_ERROR'
): asserts condition {
  if (!condition) {
    throw new ContractValidationError([{ field, message, code }]);
  }
}

/**
 * Contract validation error
 */
export class ContractValidationError extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super(`Contract validation failed: ${errors.map(e => e.message).join(', ')}`);
    this.name = 'ContractValidationError';
    this.errors = errors;
  }
}
