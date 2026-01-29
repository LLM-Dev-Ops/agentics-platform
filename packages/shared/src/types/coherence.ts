/**
 * Coherence Domain Types for Agentics Platform
 *
 * Implements ADR/DDD #005: System Coherence, Drift Detection, and Self-Governance
 *
 * These types define the core domain model for:
 * - System Coherence assessment
 * - Drift detection and categorization
 * - Lineage tracking for Memory-Anchored Reality
 * - Human Oversight boundary enforcement
 *
 * CRITICAL INVARIANTS (from ADR/DDD #005):
 * - INV-C1: Every enterprise decision must remain traceable over time
 * - INV-C2: No integration or ERP proposal exists without historical context
 * - INV-C3: Drift may be detected but never silently corrected
 * - INV-C4: Memory is authoritative; projections are derived
 * - INV-C5: Self-management never bypasses governance
 *
 * @module @agentics/shared/types/coherence
 */

// =============================================================================
// DRIFT DOMAIN
// =============================================================================

/**
 * Types of drift that can occur in the system.
 * From ADR/DDD #005 Section 2: Drift Domain
 */
export enum DriftType {
  /**
   * Semantic Drift: The meaning attributed to contracts, capabilities,
   * or artifacts changes without explicit acknowledgment.
   */
  SEMANTIC = 'semantic',

  /**
   * Structural Drift: The actual relationships between components diverge
   * from the declared architecture.
   */
  STRUCTURAL = 'structural',

  /**
   * Lineage Drift: The historical record of how artifacts were derived
   * becomes inconsistent, incomplete, or detached from current state.
   */
  LINEAGE = 'lineage',

  /**
   * Integration Drift: External system connections evolve in ways that
   * invalidate assumptions embedded in ERP Surface contracts.
   */
  INTEGRATION = 'integration',
}

/**
 * Severity level of a drift finding.
 * Used for categorization and alerting, NOT for automated action.
 */
export enum DriftSeverity {
  /** Informational: Drift detected but within expected tolerance */
  INFO = 'info',
  /** Warning: Drift may indicate potential issues */
  WARNING = 'warning',
  /** Critical: Drift represents significant divergence requiring attention */
  CRITICAL = 'critical',
}

/**
 * A specific instance of detected drift.
 * Drift findings are recorded but NEVER silently corrected (INV-C3).
 */
export interface DriftFinding {
  /** Unique identifier for this drift finding */
  id: string;

  /** Type of drift detected */
  type: DriftType;

  /** Severity classification */
  severity: DriftSeverity;

  /** Human-readable description of the drift */
  description: string;

  /** The component or artifact where drift was detected */
  source: DriftSource;

  /** Expected state based on governance rules or memory */
  expected: DriftState;

  /** Actual state observed */
  actual: DriftState;

  /** When the drift was first detected */
  detectedAt: string;

  /** Correlation ID linking to the detection context */
  correlationId: string;

  /** Reference to the governance rule or invariant violated */
  governanceReference?: string;

  /** Whether a human has acknowledged this finding */
  acknowledged: boolean;

  /** User ID who acknowledged, if applicable */
  acknowledgedBy?: string;

  /** When the finding was acknowledged */
  acknowledgedAt?: string;
}

/**
 * Identifies where drift was detected
 */
export interface DriftSource {
  /** Type of source (e.g., 'simulation', 'integration', 'artifact', 'contract') */
  sourceType: string;

  /** Unique identifier of the source */
  sourceId: string;

  /** Human-readable name */
  name: string;

  /** Path or location within the source */
  path?: string;
}

/**
 * Represents a state for comparison (expected vs actual)
 */
export interface DriftState {
  /** Timestamp of this state */
  asOf: string;

  /** Structured representation of the state */
  value: Record<string, unknown>;

  /** Hash for quick comparison */
  hash: string;

  /** Source of this state (e.g., 'memory', 'runtime', 'external') */
  origin: 'memory' | 'runtime' | 'external' | 'governance';
}

// =============================================================================
// COHERENCE DOMAIN
// =============================================================================

/**
 * Overall coherence status of the system
 */
export enum CoherenceStatus {
  /** All components are mutually consistent */
  COHERENT = 'coherent',

  /** Minor inconsistencies detected but system remains functional */
  DEGRADED = 'degraded',

  /** Significant drift detected requiring human attention */
  INCOHERENT = 'incoherent',

  /** Assessment could not be completed */
  UNKNOWN = 'unknown',
}

/**
 * Result of a coherence assessment.
 * Assessments are read-only observations, not corrective actions.
 */
export interface CoherenceAssessment {
  /** Unique identifier for this assessment */
  assessmentId: string;

  /** When the assessment was performed */
  timestamp: string;

  /** Overall coherence status */
  status: CoherenceStatus;

  /** Drift findings discovered during assessment */
  driftFindings: DriftFinding[];

  /** Summary statistics */
  summary: CoherenceSummary;

  /** Scope of what was assessed */
  scope: AssessmentScope;

  /** Correlation ID for traceability */
  correlationId: string;

  /** User ID who initiated the assessment */
  initiatedBy: string;
}

/**
 * Summary statistics for a coherence assessment
 */
export interface CoherenceSummary {
  /** Total number of components assessed */
  componentsAssessed: number;

  /** Number of drift findings by severity */
  findingsBySeverity: {
    [K in DriftSeverity]: number;
  };

  /** Number of drift findings by type */
  findingsByType: {
    [K in DriftType]: number;
  };

  /** Percentage of components without drift */
  coherenceScore: number;

  /** Time taken to complete assessment (ms) */
  assessmentDurationMs: number;
}

/**
 * Defines the scope of a coherence assessment
 */
export interface AssessmentScope {
  /** Types of components to assess */
  componentTypes: string[];

  /** Specific component IDs to assess (empty = all) */
  componentIds?: string[];

  /** Time range for historical comparison */
  timeRange?: {
    from: string;
    to: string;
  };

  /** Whether to include integration drift checks */
  includeIntegrations: boolean;

  /** Whether to include ERP Surface contract validation */
  includeErpSurface: boolean;
}

// =============================================================================
// LINEAGE DOMAIN (Memory-Anchored Reality)
// =============================================================================

/**
 * Represents the lineage of an artifact - its derivation chain.
 * Lineage is essential for temporal comparison and replay.
 */
export interface LineageRecord {
  /** Unique identifier for this lineage record */
  lineageId: string;

  /** The artifact this lineage describes */
  artifact: ArtifactReference;

  /** Direct parent(s) from which this artifact was derived */
  derivedFrom: ArtifactReference[];

  /** The operation that produced this artifact */
  derivationOperation: DerivationOperation;

  /** Governance context at time of derivation */
  governanceContext: GovernanceContext;

  /** When the derivation occurred */
  derivedAt: string;

  /** User who authorized the derivation */
  authorizedBy: string;

  /** Correlation ID for traceability */
  correlationId: string;
}

/**
 * Reference to an artifact in the system
 */
export interface ArtifactReference {
  /** Type of artifact */
  artifactType: ArtifactType;

  /** Unique identifier */
  artifactId: string;

  /** Version of the artifact */
  version: string;

  /** Hash for integrity verification */
  contentHash: string;
}

/**
 * Types of artifacts that can have lineage
 */
export enum ArtifactType {
  /** Simulation plan or result */
  SIMULATION = 'simulation',

  /** Exported configuration */
  EXPORT = 'export',

  /** Deployment artifact */
  DEPLOYMENT = 'deployment',

  /** Proposal document */
  PROPOSAL = 'proposal',

  /** Decision record */
  DECISION = 'decision',

  /** ERP Surface contract */
  ERP_CONTRACT = 'erp_contract',

  /** Integration configuration */
  INTEGRATION = 'integration',

  /** Memory snapshot */
  MEMORY_SNAPSHOT = 'memory_snapshot',
}

/**
 * Describes the operation that created an artifact
 */
export interface DerivationOperation {
  /** Type of operation */
  operationType: string;

  /** Human-readable description */
  description: string;

  /** Parameters used in the operation */
  parameters: Record<string, unknown>;

  /** Whether the operation is deterministic (can be replayed) */
  deterministic: boolean;
}

/**
 * Governance context at time of artifact creation
 */
export interface GovernanceContext {
  /** Active governance rules at derivation time */
  activeRules: string[];

  /** ADR version in effect */
  adrVersion: string;

  /** Policy IDs that were evaluated */
  policiesEvaluated: string[];

  /** Compliance status at derivation time */
  complianceStatus: 'compliant' | 'exception_granted' | 'pending_review';
}

// =============================================================================
// HUMAN OVERSIGHT DOMAIN
// =============================================================================

/**
 * Categories of decisions that require human oversight.
 * From ADR/DDD #005 Section 5: Human Oversight Boundary
 */
export enum DecisionCategory {
  /** Enterprise policy changes */
  POLICY_CHANGE = 'policy_change',

  /** Governance rule modifications */
  GOVERNANCE_MODIFICATION = 'governance_modification',

  /** Production deployment authorization */
  DEPLOYMENT_AUTHORIZATION = 'deployment_authorization',

  /** Exception approval */
  EXCEPTION_APPROVAL = 'exception_approval',

  /** Drift remediation strategy */
  DRIFT_REMEDIATION = 'drift_remediation',

  /** ERP Surface contract evolution */
  ERP_CONTRACT_EVOLUTION = 'erp_contract_evolution',
}

/**
 * Status of a decision requiring human authorization
 */
export enum DecisionStatus {
  /** Awaiting human review */
  PENDING = 'pending',

  /** Approved by authorized human */
  APPROVED = 'approved',

  /** Rejected by authorized human */
  REJECTED = 'rejected',

  /** Expired without decision */
  EXPIRED = 'expired',

  /** Superseded by newer decision */
  SUPERSEDED = 'superseded',
}

/**
 * Record of a decision requiring human authorization.
 * Implements INV-C1: Every enterprise decision must remain traceable.
 */
export interface DecisionRecord {
  /** Unique identifier for this decision */
  decisionId: string;

  /** Category of decision */
  category: DecisionCategory;

  /** Current status */
  status: DecisionStatus;

  /** What is being decided */
  subject: DecisionSubject;

  /** Who initiated the decision request */
  initiatedBy: string;

  /** When the decision was initiated */
  initiatedAt: string;

  /** Who made the decision (if resolved) */
  decidedBy?: string;

  /** When the decision was made */
  decidedAt?: string;

  /** Rationale provided for the decision */
  rationale?: string;

  /** Context information for decision-making */
  context: DecisionContext;

  /** Historical context (INV-C2) */
  historicalContext: HistoricalContext;

  /** Correlation ID for traceability */
  correlationId: string;

  /** Audit trail of all actions on this decision */
  auditTrail: DecisionAuditEntry[];
}

/**
 * What is being decided
 */
export interface DecisionSubject {
  /** Type of subject */
  subjectType: string;

  /** Identifier of the subject */
  subjectId: string;

  /** Human-readable description */
  description: string;

  /** The proposed change or action */
  proposedAction: Record<string, unknown>;

  /** Impact assessment */
  impactAssessment?: ImpactAssessment;
}

/**
 * Impact assessment for a proposed decision
 */
export interface ImpactAssessment {
  /** Affected components */
  affectedComponents: string[];

  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  /** Reversibility */
  reversible: boolean;

  /** Dependencies that may be affected */
  affectedDependencies: string[];
}

/**
 * Context for decision-making
 */
export interface DecisionContext {
  /** Governance rules applicable to this decision */
  applicableRules: string[];

  /** Prior related decisions */
  relatedDecisions: string[];

  /** Current system state relevant to decision */
  relevantState: Record<string, unknown>;

  /** Drift findings that prompted this decision (if applicable) */
  relatedDriftFindings?: string[];
}

/**
 * Historical context for a decision (INV-C2)
 */
export interface HistoricalContext {
  /** ERP Surface contract version at time of proposal */
  erpSurfaceVersion?: string;

  /** Integration states at time of proposal */
  integrationStates: IntegrationState[];

  /** Prior decisions that inform this one */
  precedentDecisions: PrecedentDecision[];

  /** Lineage chain leading to this decision */
  lineageChain: string[];
}

/**
 * State of an integration at a point in time
 */
export interface IntegrationState {
  /** Integration identifier */
  integrationId: string;

  /** Integration name */
  name: string;

  /** State hash at capture time */
  stateHash: string;

  /** When state was captured */
  capturedAt: string;
}

/**
 * Reference to a prior decision that informs current decision
 */
export interface PrecedentDecision {
  /** Decision ID */
  decisionId: string;

  /** How it relates to current decision */
  relevance: string;

  /** Outcome of that decision */
  outcome: DecisionStatus;
}

/**
 * Audit entry for decision lifecycle
 */
export interface DecisionAuditEntry {
  /** Timestamp of the action */
  timestamp: string;

  /** Action taken */
  action: string;

  /** User who performed the action */
  userId: string;

  /** Additional details */
  details?: Record<string, unknown>;

  /** Correlation ID */
  correlationId: string;
}

// =============================================================================
// SYSTEM INVARIANT TYPES
// =============================================================================

/**
 * Represents a system invariant from ADR/DDD #005
 */
export interface SystemInvariant {
  /** Invariant identifier (e.g., 'INV-C1') */
  invariantId: string;

  /** Human-readable description */
  description: string;

  /** Category of invariant */
  category: InvariantCategory;

  /** Whether this invariant is currently enforced */
  enforced: boolean;

  /** Last time this invariant was validated */
  lastValidated?: string;

  /** Result of last validation */
  lastValidationResult?: InvariantValidationResult;
}

/**
 * Categories of system invariants
 */
export enum InvariantCategory {
  /** Decision traceability */
  TRACEABILITY = 'traceability',

  /** Historical context requirements */
  HISTORICAL_CONTEXT = 'historical_context',

  /** Drift handling rules */
  DRIFT_HANDLING = 'drift_handling',

  /** Memory authority rules */
  MEMORY_AUTHORITY = 'memory_authority',

  /** Governance enforcement */
  GOVERNANCE = 'governance',
}

/**
 * Result of validating a system invariant
 */
export interface InvariantValidationResult {
  /** Whether the invariant holds */
  valid: boolean;

  /** Timestamp of validation */
  validatedAt: string;

  /** Violations found (if any) */
  violations: InvariantViolation[];

  /** Context of the validation */
  validationContext: Record<string, unknown>;
}

/**
 * A specific violation of a system invariant
 */
export interface InvariantViolation {
  /** Description of the violation */
  description: string;

  /** Where the violation occurred */
  location: string;

  /** Evidence of the violation */
  evidence: Record<string, unknown>;

  /** When the violation was detected */
  detectedAt: string;
}

// =============================================================================
// ALERT AND NOTIFICATION TYPES
// =============================================================================

/**
 * Alert surfaced to human operators.
 * Alerts inform but do not trigger automated action (INV-C3).
 */
export interface CoherenceAlert {
  /** Unique alert identifier */
  alertId: string;

  /** Type of alert */
  alertType: AlertType;

  /** Severity level */
  severity: DriftSeverity;

  /** Alert title */
  title: string;

  /** Detailed message */
  message: string;

  /** Source of the alert */
  source: AlertSource;

  /** When the alert was raised */
  raisedAt: string;

  /** Whether the alert has been seen */
  acknowledged: boolean;

  /** Who acknowledged the alert */
  acknowledgedBy?: string;

  /** When it was acknowledged */
  acknowledgedAt?: string;

  /** Related drift findings */
  relatedFindings?: string[];

  /** Suggested actions (informational only) */
  suggestedActions?: string[];

  /** Correlation ID for traceability */
  correlationId: string;
}

/**
 * Types of coherence alerts
 */
export enum AlertType {
  /** Drift detected */
  DRIFT_DETECTED = 'drift_detected',

  /** Invariant violation */
  INVARIANT_VIOLATION = 'invariant_violation',

  /** Decision pending timeout */
  DECISION_TIMEOUT = 'decision_timeout',

  /** Lineage integrity issue */
  LINEAGE_INTEGRITY = 'lineage_integrity',

  /** Integration state change */
  INTEGRATION_CHANGE = 'integration_change',
}

/**
 * Source of a coherence alert
 */
export interface AlertSource {
  /** System component that raised the alert */
  component: string;

  /** Operation that triggered the alert */
  operation: string;

  /** Additional context */
  context: Record<string, unknown>;
}

// =============================================================================
// COMPARISON AND DIFF TYPES (Architectural Primitives)
// =============================================================================

/**
 * Result of comparing two states.
 * Diffing is an architectural primitive per ADR/DDD #005.
 */
export interface StateDiff {
  /** Identifier for this diff */
  diffId: string;

  /** Baseline state */
  baseline: StateSnapshot;

  /** Comparison state */
  comparison: StateSnapshot;

  /** Individual differences found */
  differences: Difference[];

  /** Summary of changes */
  summary: DiffSummary;

  /** When the diff was computed */
  computedAt: string;
}

/**
 * Snapshot of state at a point in time
 */
export interface StateSnapshot {
  /** Snapshot identifier */
  snapshotId: string;

  /** When the snapshot was taken */
  timestamp: string;

  /** Hash of the snapshot content */
  hash: string;

  /** Type of state captured */
  stateType: string;

  /** The actual state data */
  state: Record<string, unknown>;
}

/**
 * A single difference between two states
 */
export interface Difference {
  /** Path to the differing element */
  path: string;

  /** Type of difference */
  differenceType: 'added' | 'removed' | 'modified';

  /** Value in baseline (if applicable) */
  baselineValue?: unknown;

  /** Value in comparison (if applicable) */
  comparisonValue?: unknown;
}

/**
 * Summary of differences between states
 */
export interface DiffSummary {
  /** Number of additions */
  additions: number;

  /** Number of removals */
  removals: number;

  /** Number of modifications */
  modifications: number;

  /** Paths that changed */
  changedPaths: string[];

  /** Whether states are equivalent */
  equivalent: boolean;
}
