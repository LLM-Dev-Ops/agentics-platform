/**
 * Intent Domain Types for Agentics Platform
 *
 * Implements ADR/DDD #006: UI Control Surface Architecture
 *
 * Intent Types define the semantic category of user actions:
 * - Observation: Read-only operations (view state, query)
 * - Synthesis: Generate artifacts without committing (plan, preview)
 * - Commitment: Modify state (requires explicit confirmation)
 *
 * UI INVARIANTS (INV-U1 through INV-U6):
 * - INV-U1: Entry Point Equivalence (UI = CLI semantics)
 * - INV-U2: Governance Uniformity (same validation regardless of entry point)
 * - INV-U3: Intent Explicitness (no inference from ambiguous input)
 * - INV-U4: Commitment Confirmation (explicit confirmation for state changes)
 * - INV-U5: Governance Visibility (surface constraints visibly)
 * - INV-U6: Audit Completeness (full audit trail for UI actions)
 *
 * @module @agentics/shared/types/intent
 */

// =============================================================================
// INTENT CATEGORY AND STATUS
// =============================================================================

/**
 * Categories of user intent that determine workflow requirements.
 * From ADR/DDD #006 Section 2: Intent Domain
 */
export enum IntentCategory {
  /**
   * Observation Intent: Read-only operations.
   * Examples: View state, query data, list resources
   * Governance: Minimal - access control only
   */
  OBSERVATION = 'observation',

  /**
   * Synthesis Intent: Generate artifacts without committing.
   * Examples: Plan simulation, preview changes, generate report
   * Governance: Moderate - within declared boundaries
   */
  SYNTHESIS = 'synthesis',

  /**
   * Commitment Intent: Modify committed state.
   * Examples: Create resource, approve decision, deploy configuration
   * Governance: Maximum - requires explicit confirmation
   */
  COMMITMENT = 'commitment',
}

/**
 * Lifecycle status of an intent.
 * Tracks intent from declaration through execution.
 */
export enum IntentStatus {
  /** Intent declared but not yet validated against governance */
  DECLARED = 'declared',

  /** Intent validated and permitted by governance */
  VALIDATED = 'validated',

  /** Commitment intent awaiting explicit user confirmation */
  PENDING_CONFIRMATION = 'pending_confirmation',

  /** Commitment intent confirmed by user, ready for execution */
  CONFIRMED = 'confirmed',

  /** Intent executed successfully */
  EXECUTED = 'executed',

  /** Intent execution failed */
  FAILED = 'failed',

  /** Intent cancelled by user before execution */
  CANCELLED = 'cancelled',
}

/**
 * Workflow phases that mirror claude-flow's Plan -> Review -> Commit -> Inspect.
 * From ADR/DDD #006 Section 3: Claude-Flow Mental Model Parity
 */
export enum WorkflowPhase {
  /** User is declaring/specifying intent */
  PLAN = 'plan',

  /** Showing preview, constraints, and consequences */
  REVIEW = 'review',

  /** Awaiting explicit confirmation (commitment only) */
  COMMIT = 'commit',

  /** Showing execution result for inspection */
  INSPECT = 'inspect',
}

// =============================================================================
// ENTRY POINT AND DOMAIN
// =============================================================================

/**
 * Entry points through which intents can be declared.
 * Used for audit trail, NOT for differential validation (INV-U2).
 */
export enum EntryPoint {
  /** User interface (web application) */
  UI = 'ui',

  /** Command-line interface */
  CLI = 'cli',

  /** Direct API access */
  API = 'api',
}

/**
 * Domains that operations can target.
 * Each domain has specific operations and governance rules.
 */
export enum IntentDomain {
  /** API key management operations */
  API_KEYS = 'api_keys',

  /** Coherence and drift operations */
  COHERENCE = 'coherence',

  /** Simulation operations */
  SIMULATION = 'simulation',

  /** Configuration changes */
  CONFIGURATION = 'configuration',

  /** Deployment operations */
  DEPLOYMENT = 'deployment',

  /** User and organization management */
  IDENTITY = 'identity',

  /** Governance rule management */
  GOVERNANCE = 'governance',
}

// =============================================================================
// INTENT OPERATION
// =============================================================================

/**
 * Describes a specific operation that can be performed.
 * Operations are typed and explicit - no inference allowed (INV-U3).
 */
export interface IntentOperation {
  /** Domain the operation targets */
  domain: IntentDomain;

  /** Specific action within the domain (e.g., 'create', 'revoke', 'acknowledge') */
  action: string;

  /** Human-readable description of the operation */
  description: string;

  /** Required authorization scopes for this operation */
  requiredScopes: string[];

  /** Whether this operation modifies state (determines intent category) */
  modifiesState: boolean;
}

// =============================================================================
// GOVERNANCE VALIDATION
// =============================================================================

/**
 * Result of validating an intent against governance rules.
 * Governance is surfaced, not hidden (INV-U5).
 */
export interface GovernanceValidationResult {
  /** Whether the intent is permitted to proceed */
  permitted: boolean;

  /** Constraints that apply to this intent */
  constraints: GovernanceConstraint[];

  /** Warnings that should be displayed (do not block execution) */
  warnings: GovernanceWarning[];

  /** If not permitted, the reason for denial */
  denialReason?: string;

  /** Required confirmations for commitment intents (INV-U4) */
  requiredConfirmations: ConfirmationRequirement[];

  /** When validation was performed */
  validatedAt: string;

  /** Governance rules that were evaluated */
  rulesEvaluated: string[];

  /** ADR version in effect during validation */
  adrVersion: string;
}

/**
 * A governance constraint that applies to an intent.
 * Constraints are visible to users (INV-U5).
 */
export interface GovernanceConstraint {
  /** Unique identifier for this constraint */
  constraintId: string;

  /** Human-readable description */
  description: string;

  /** Severity level */
  severity: 'info' | 'warning' | 'blocking';

  /** Source governance rule (e.g., 'ADR-006/INV-U4') */
  sourceRule: string;

  /** Whether this constraint was satisfied */
  satisfied: boolean;
}

/**
 * A warning about an intent that does not block execution.
 */
export interface GovernanceWarning {
  /** Warning identifier */
  warningId: string;

  /** Warning message */
  message: string;

  /** Related constraint, if any */
  constraintId?: string;

  /** Suggested action to address the warning */
  suggestedAction?: string;
}

// =============================================================================
// CONFIRMATION REQUIREMENTS
// =============================================================================

/**
 * Confirmation requirement for commitment intents.
 * Implements INV-U4: Commitment Confirmation.
 */
export interface ConfirmationRequirement {
  /** Unique identifier for this requirement */
  requirementId: string;

  /** Type of confirmation required */
  type: ConfirmationType;

  /** What the user must confirm */
  description: string;

  /** If multi-step, the individual steps required */
  steps?: ConfirmationStep[];

  /** Whether this requirement has been satisfied */
  satisfied: boolean;

  /** When satisfied */
  satisfiedAt?: string;

  /** Who satisfied this requirement */
  satisfiedBy?: string;
}

/**
 * Types of confirmation that can be required.
 */
export enum ConfirmationType {
  /** Simple acknowledgment of consequences */
  ACKNOWLEDGE = 'acknowledge',

  /** Explicit affirmative confirmation */
  EXPLICIT_CONFIRM = 'explicit_confirm',

  /** Multi-step confirmation workflow */
  MULTI_STEP = 'multi_step',

  /** Requires typing specific text to confirm */
  TYPE_TO_CONFIRM = 'type_to_confirm',
}

/**
 * A step in a multi-step confirmation workflow.
 */
export interface ConfirmationStep {
  /** Step identifier */
  stepId: string;

  /** Step number in sequence */
  stepNumber: number;

  /** What this step confirms */
  description: string;

  /** Whether this step is completed */
  completed: boolean;

  /** When completed */
  completedAt?: string;
}

// =============================================================================
// PREVIEW DATA
// =============================================================================

/**
 * Preview data shown during the Review phase.
 * Shows what will happen before execution.
 */
export interface PreviewData {
  /** Unique identifier for this preview */
  previewId: string;

  /** Intent this preview is for */
  intentId: string;

  /** Proposed changes */
  changes: ProposedChange[];

  /** Impact assessment */
  impact: ImpactSummary;

  /** Governance constraints that apply */
  constraints: GovernanceConstraint[];

  /** Warnings to display */
  warnings: GovernanceWarning[];

  /** When this preview was generated */
  generatedAt: string;

  /** How long this preview is valid */
  expiresAt: string;
}

/**
 * A proposed change that would result from executing the intent.
 */
export interface ProposedChange {
  /** Type of change */
  changeType: 'create' | 'update' | 'delete';

  /** Type of resource being changed */
  resourceType: string;

  /** Identifier of the resource (if existing) */
  resourceId?: string;

  /** Human-readable description of the change */
  description: string;

  /** Current state (for update/delete) */
  before?: Record<string, unknown>;

  /** Proposed state (for create/update) */
  after?: Record<string, unknown>;

  /** Fields that differ (for update) */
  changedFields?: string[];
}

/**
 * Summary of the impact of executing an intent.
 */
export interface ImpactSummary {
  /** Resources that will be affected */
  affectedResources: AffectedResource[];

  /** Whether the operation is reversible */
  reversible: boolean;

  /** How to reverse the operation, if applicable */
  reversalMethod?: string;

  /** Downstream effects beyond direct changes */
  downstreamEffects: string[];

  /** Risk level of this operation */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * A resource affected by an intent.
 */
export interface AffectedResource {
  /** Type of resource */
  resourceType: string;

  /** Resource identifier */
  resourceId: string;

  /** How it's affected */
  affectType: 'direct' | 'indirect' | 'dependent';

  /** Description of the effect */
  description: string;
}

// =============================================================================
// EXECUTION RESULT
// =============================================================================

/**
 * Result of executing an intent.
 * Shown during the Inspect phase.
 */
export interface ExecutionResult {
  /** Unique identifier for this execution */
  executionId: string;

  /** Intent that was executed */
  intentId: string;

  /** Whether execution was successful */
  success: boolean;

  /** Result data (if successful) */
  data?: Record<string, unknown>;

  /** Error information (if failed) */
  error?: ExecutionError;

  /** Changes that were actually made */
  actualChanges: ActualChange[];

  /** When execution started */
  startedAt: string;

  /** When execution completed */
  completedAt: string;

  /** Duration in milliseconds */
  durationMs: number;

  /** Correlation ID for tracing */
  correlationId: string;
}

/**
 * Error that occurred during execution.
 */
export interface ExecutionError {
  /** Error code */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Detailed error information */
  details?: Record<string, unknown>;

  /** Whether the error is retryable */
  retryable: boolean;

  /** Suggested action to resolve */
  suggestedAction?: string;
}

/**
 * A change that was actually made during execution.
 */
export interface ActualChange {
  /** Type of change */
  changeType: 'created' | 'updated' | 'deleted';

  /** Type of resource changed */
  resourceType: string;

  /** Resource identifier */
  resourceId: string;

  /** Description of what changed */
  description: string;

  /** Previous state (for update/delete) */
  previousState?: Record<string, unknown>;

  /** New state (for create/update) */
  newState?: Record<string, unknown>;
}

// =============================================================================
// CORE INTENT TYPE
// =============================================================================

/**
 * Core Intent type representing a user's declared intent.
 * Central to the control surface architecture.
 *
 * @template TPayload - Type of the operation-specific payload
 */
export interface Intent<TPayload = Record<string, unknown>> {
  /** Unique identifier for this intent */
  intentId: string;

  /** Category of intent (determines workflow) */
  category: IntentCategory;

  /** Current lifecycle status */
  status: IntentStatus;

  /** Current workflow phase */
  phase: WorkflowPhase;

  /** The operation being performed */
  operation: IntentOperation;

  /** Operation-specific payload */
  payload: TPayload;

  /** Entry point that created this intent */
  entryPoint: EntryPoint;

  /** Governance validation result */
  governanceResult?: GovernanceValidationResult;

  /** Preview data (for synthesis/commitment) */
  preview?: PreviewData;

  /** Execution result (if executed) */
  result?: ExecutionResult;

  /** User who declared the intent */
  declaredBy: string;

  /** When intent was declared */
  declaredAt: string;

  /** User who confirmed (commitment only) */
  confirmedBy?: string;

  /** When confirmed */
  confirmedAt?: string;

  /** When executed */
  executedAt?: string;

  /** Correlation ID for traceability (INV-U6) */
  correlationId: string;

  /** Organization context */
  orgId: string;

  /** Audit trail of all actions on this intent */
  auditTrail: IntentAuditEntry[];
}

// =============================================================================
// AUDIT TYPES
// =============================================================================

/**
 * Audit entry for intent lifecycle.
 * Implements INV-U6: Audit Completeness.
 */
export interface IntentAuditEntry {
  /** Unique identifier for this entry */
  entryId: string;

  /** Timestamp of the action */
  timestamp: string;

  /** Action that was taken */
  action: IntentAuditAction;

  /** User who performed the action */
  userId: string;

  /** Entry point used */
  entryPoint: EntryPoint;

  /** Phase before the action */
  phaseBefore: WorkflowPhase;

  /** Phase after the action */
  phaseAfter: WorkflowPhase;

  /** Additional context */
  context?: Record<string, unknown>;

  /** Correlation ID for this action */
  correlationId: string;
}

/**
 * Actions that can be taken on an intent.
 */
export type IntentAuditAction =
  | 'intent_declared'
  | 'intent_validated'
  | 'validation_failed'
  | 'preview_generated'
  | 'confirmation_started'
  | 'confirmation_step_completed'
  | 'intent_confirmed'
  | 'execution_started'
  | 'intent_executed'
  | 'execution_failed'
  | 'intent_cancelled'
  | 'intent_expired';

// =============================================================================
// CONTROL SURFACE WORKFLOW
// =============================================================================

/**
 * State of a control surface workflow.
 * Tracks the full Plan -> Review -> Commit -> Inspect cycle.
 */
export interface ControlSurfaceWorkflow {
  /** Unique identifier for this workflow */
  workflowId: string;

  /** Current phase */
  phase: WorkflowPhase;

  /** The intent being processed */
  intent: Intent;

  /** Available transitions from current phase */
  availableTransitions: WorkflowTransition[];

  /** Whether the workflow is complete */
  complete: boolean;

  /** When the workflow started */
  startedAt: string;

  /** When the workflow completed (if complete) */
  completedAt?: string;
}

/**
 * A possible transition in the workflow.
 */
export interface WorkflowTransition {
  /** Target phase */
  targetPhase: WorkflowPhase;

  /** Action to trigger this transition */
  action: string;

  /** Whether this transition is currently available */
  available: boolean;

  /** Why not available, if applicable */
  unavailableReason?: string;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Request to declare a new intent.
 */
export interface DeclareIntentRequest {
  /** Domain of the operation */
  domain: IntentDomain;

  /** Action within the domain */
  action: string;

  /** Operation-specific payload */
  payload: Record<string, unknown>;

  /** Entry point making the request */
  entryPoint: EntryPoint;

  /** Correlation ID for tracing */
  correlationId?: string;
}

/**
 * Request to confirm a commitment intent.
 */
export interface ConfirmIntentRequest {
  /** Intent to confirm */
  intentId: string;

  /** Confirmation acknowledgments */
  acknowledgments: ConfirmationAcknowledgment[];
}

/**
 * Acknowledgment of a confirmation requirement.
 */
export interface ConfirmationAcknowledgment {
  /** Requirement being acknowledged */
  requirementId: string;

  /** For type-to-confirm, the typed text */
  typedConfirmation?: string;

  /** Steps completed (for multi-step) */
  completedSteps?: string[];
}

/**
 * Request to execute an intent.
 */
export interface ExecuteIntentRequest {
  /** Intent to execute */
  intentId: string;
}

/**
 * Request to cancel an intent.
 */
export interface CancelIntentRequest {
  /** Intent to cancel */
  intentId: string;

  /** Reason for cancellation */
  reason?: string;
}
