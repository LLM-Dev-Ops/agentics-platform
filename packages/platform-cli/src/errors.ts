/**
 * CLI-specific error classes for agentics-platform-cli
 *
 * These errors provide structured, actionable messages for CLI users
 * and support exit code handling for scripting.
 */

/** Base error for all platform CLI errors */
export class PlatformCliError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = 'PlatformCliError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Context resolution errors */
export class ContextResolutionError extends PlatformCliError {
  constructor(
    message: string,
    public readonly missingField: 'org' | 'env' | 'both'
  ) {
    super(
      `${message}\n\nTo fix this:\n` +
      `  - Use --org and --env flags\n` +
      `  - Set AGENTICS_ORG and AGENTICS_ENV environment variables\n` +
      `  - Create a .agentics-manifest.json in your project\n` +
      `  - Run 'agentics-platform org switch <org-id>' and 'agentics-platform env switch <env-id>'`,
      'CONTEXT_RESOLUTION_ERROR',
      2
    );
    this.name = 'ContextResolutionError';
  }
}

/** Policy validation errors */
export class PolicyViolationError extends PlatformCliError {
  constructor(
    _message: string,
    public readonly violations: PolicyViolation[]
  ) {
    const violationList = violations
      .map((v, i) => `  ${i + 1}. [${v.ruleId}] ${v.description}\n     Source: ${v.sourceDoc}`)
      .join('\n');
    super(
      `Policy violation detected:\n${violationList}\n\n` +
      `This operation violates architectural constraints. ` +
      `Review the architecture documents for guidance.`,
      'POLICY_VIOLATION_ERROR',
      3
    );
    this.name = 'PolicyViolationError';
  }
}

export interface PolicyViolation {
  ruleId: string;
  description: string;
  sourceDoc: string;
  severity: 'critical' | 'high' | 'medium';
}

/** Delegation/forwarding errors */
export class DelegationError extends PlatformCliError {
  constructor(
    message: string,
    public readonly targetCommand: string,
    public readonly originalError?: Error
  ) {
    super(
      `Failed to delegate command to agentics CLI:\n` +
      `  Command: ${targetCommand}\n` +
      `  Error: ${message}\n\n` +
      `Ensure @agentics/cli is installed and accessible.`,
      'DELEGATION_ERROR',
      4
    );
    this.name = 'DelegationError';
  }
}

/** Dry-run result (not an error, but uses same pattern) */
export class DryRunResult extends PlatformCliError {
  constructor(
    public readonly plannedActions: string[],
    public readonly affectedResources: string[]
  ) {
    const actionList = plannedActions.map(a => `  - ${a}`).join('\n');
    const resourceList = affectedResources.map(r => `  - ${r}`).join('\n');
    super(
      `DRY RUN - No changes will be made\n\n` +
      `Planned actions:\n${actionList}\n\n` +
      `Affected resources:\n${resourceList}`,
      'DRY_RUN_RESULT',
      0  // Exit 0 for successful dry-run
    );
    this.name = 'DryRunResult';
  }
}

/** Authentication errors */
export class AuthenticationError extends PlatformCliError {
  constructor(message: string) {
    super(
      `${message}\n\n` +
      `To authenticate:\n` +
      `  - Run 'agentics login' to authenticate interactively\n` +
      `  - Set AGENTICS_API_KEY environment variable`,
      'AUTHENTICATION_ERROR',
      5
    );
    this.name = 'AuthenticationError';
  }
}

/** Lifecycle state errors */
export class LifecycleStateError extends PlatformCliError {
  constructor(
    public readonly intentId: string,
    public readonly currentState: string,
    public readonly attemptedTransition: string
  ) {
    super(
      `Cannot transition intent '${intentId}' from '${currentState}' to '${attemptedTransition}'.\n` +
      `This transition is not allowed by the governance workflow.`,
      'LIFECYCLE_STATE_ERROR',
      6
    );
    this.name = 'LifecycleStateError';
  }
}

/** Confirmation-required errors (HTTP 409 equivalent) */
export class ConfirmationRequiredError extends PlatformCliError {
  constructor(
    public readonly commandPath: string,
    public readonly riskLevel: 'high' | 'critical'
  ) {
    super(
      `Command '${commandPath}' is a ${riskLevel}-risk operation and requires explicit confirmation.\n\n` +
      `To execute this command, add the --confirmed flag:\n` +
      `  agentics-platform ${commandPath} --confirmed\n\n` +
      `Or set confirmed: true in a structured input payload.`,
      'CONFIRMATION_REQUIRED',
      9  // exit code 9 = confirmation required (maps to HTTP 409)
    );
    this.name = 'ConfirmationRequiredError';
  }
}

/** Architecture document parsing errors */
export class ArchitectureParseError extends PlatformCliError {
  constructor(
    public readonly documentPath: string,
    public readonly parseError: string
  ) {
    super(
      `Failed to parse architecture document:\n` +
      `  Path: ${documentPath}\n` +
      `  Error: ${parseError}\n\n` +
      `Ensure the document exists and follows the expected format.`,
      'ARCHITECTURE_PARSE_ERROR',
      7
    );
    this.name = 'ArchitectureParseError';
  }
}

/** Format error for displaying to user */
export function formatError(error: Error): string {
  if (error instanceof PlatformCliError) {
    return `Error [${error.code}]: ${error.message}`;
  }
  return `Error: ${error.message}`;
}

/** Get exit code from error */
export function getExitCode(error: Error): number {
  if (error instanceof PlatformCliError) {
    return error.exitCode;
  }
  return 1;
}
