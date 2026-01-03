/**
 * Pre/post execution hooks for command interception
 */

import type { ExecutionContext } from '../types/context.js';
import type { AuditEvent } from '../types/provenance.js';
import { createAuditEvent } from '../delegation/provenance.js';

/** Pre-execution hook result */
export interface PreExecutionResult {
  proceed: boolean;
  modifiedArgs?: string[];
  error?: Error;
}

/** Post-execution hook result */
export interface PostExecutionResult {
  auditEvent: AuditEvent;
}

/** Interceptor configuration */
export interface InterceptorConfig {
  enableAudit: boolean;
  enablePolicyCheck: boolean;
  enableContextValidation: boolean;
}

const defaultConfig: InterceptorConfig = {
  enableAudit: true,
  enablePolicyCheck: true,
  enableContextValidation: true,
};

/**
 * Pre-execution interceptor
 * Runs before command execution to validate and prepare
 */
export async function preExecute(
  _command: string,
  args: string[],
  context: ExecutionContext,
  config: InterceptorConfig = defaultConfig
): Promise<PreExecutionResult> {
  // 1. Validate context is complete
  if (config.enableContextValidation) {
    if (!context.org?.orgId) {
      return {
        proceed: false,
        error: new Error('Organization context is required'),
      };
    }
    if (!context.env?.envId) {
      return {
        proceed: false,
        error: new Error('Environment context is required'),
      };
    }
  }

  // 2. Policy checks are done at the command level, not here
  // This allows commands to handle policy violations appropriately

  return {
    proceed: true,
    modifiedArgs: args,
  };
}

/**
 * Post-execution interceptor
 * Runs after command execution for audit and cleanup
 */
export async function postExecute(
  command: string,
  args: string[],
  context: ExecutionContext,
  outcome: 'success' | 'failure' | 'dry-run',
  startTime: number,
  errorMessage?: string,
  _config: InterceptorConfig = defaultConfig
): Promise<PostExecutionResult> {
  const durationMs = Date.now() - startTime;

  // Create audit event
  const auditEvent = createAuditEvent(
    command,
    args,
    context,
    outcome,
    durationMs,
    errorMessage
  );

  // In a full implementation, this would emit the audit event
  // to an audit log service. For now, we just return it.

  return {
    auditEvent,
  };
}

/**
 * Wrap a command execution with interceptors
 */
export async function withInterceptors<T>(
  command: string,
  args: string[],
  context: ExecutionContext,
  executor: () => Promise<T>,
  config: InterceptorConfig = defaultConfig
): Promise<T> {
  const startTime = Date.now();

  // Pre-execution
  const preResult = await preExecute(command, args, context, config);
  if (!preResult.proceed) {
    await postExecute(command, args, context, 'failure', startTime, preResult.error?.message, config);
    throw preResult.error ?? new Error('Pre-execution check failed');
  }

  try {
    // Execute command
    const result = await executor();

    // Post-execution (success)
    const outcome = context.dryRun ? 'dry-run' : 'success';
    await postExecute(command, args, context, outcome, startTime, undefined, config);

    return result;
  } catch (error) {
    // Post-execution (failure)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await postExecute(command, args, context, 'failure', startTime, errorMessage, config);
    throw error;
  }
}
