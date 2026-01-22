/**
 * Agent Errors
 */

/**
 * Base agent error
 */
export class AgentError extends Error {
  public readonly code: string;
  public readonly agentId: string;
  public readonly correlationId?: string;

  constructor(
    message: string,
    code: string,
    agentId: string,
    correlationId?: string
  ) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.agentId = agentId;
    this.correlationId = correlationId;
  }
}

/**
 * Agent invocation error
 */
export class AgentInvocationError extends AgentError {
  constructor(message: string, agentId: string, correlationId?: string) {
    super(message, 'INVOCATION_ERROR', agentId, correlationId);
    this.name = 'AgentInvocationError';
  }
}

/**
 * Agent validation error
 */
export class AgentValidationError extends AgentError {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    agentId: string,
    validationErrors: Array<{ field: string; message: string }>,
    correlationId?: string
  ) {
    super(message, 'VALIDATION_ERROR', agentId, correlationId);
    this.name = 'AgentValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Agent boundary violation error
 */
export class AgentBoundaryViolationError extends AgentError {
  public readonly violation: string;

  constructor(violation: string, agentId: string, correlationId?: string) {
    super(`Agent boundary violation: ${violation}`, 'BOUNDARY_VIOLATION', agentId, correlationId);
    this.name = 'AgentBoundaryViolationError';
    this.violation = violation;
  }
}

/**
 * Agent persistence error
 */
export class AgentPersistenceError extends AgentError {
  constructor(message: string, agentId: string, correlationId?: string) {
    super(message, 'PERSISTENCE_ERROR', agentId, correlationId);
    this.name = 'AgentPersistenceError';
  }
}
