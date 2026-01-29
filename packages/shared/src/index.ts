/**
 * Shared Types and Constants for Layer 4 Agentics Platform
 *
 * This package contains all shared TypeScript types, interfaces, and constants
 * used across the platform services as defined in the SPARC specification.
 *
 * @module @agentics/shared
 */

// API Types
export type {
  ErrorResponse,
  PaginationParams,
  PaginationMeta,
  HealthResponse,
  SuccessResponse,
} from './types/api.js';
export { ErrorCode } from './types/api.js';

// Identity & Authentication Types
export type {
  AuthCredentials,
  AuthResult,
  Identity,
  ApiKey,
  CreateApiKeyParams,
  CreateApiKeyResponse,
  RevokeApiKeyParams,
  ListApiKeysResponse,
} from './types/identity.js';
export { Scope } from './types/identity.js';

// Simulation Types
export type {
  SimulateParams,
  SimulationSpecification,
  SimulationResult,
  SimulationStatus,
  CancelSimulationParams,
  ListSimulationsResponse,
} from './types/simulation.js';
export { SimulationStatusEnum } from './types/simulation.js';

// Intelligence (AI/ML) Types
export type {
  CompletionParams,
  TokenUsage,
  Completion,
  EmbeddingParams,
  Embedding,
  Embeddings,
  ModelCapabilities,
  Model,
  ListModelsResponse,
  FineTuneParams,
  FineTuneJob,
} from './types/intelligence.js';

// Usage Tracking Types
export type {
  UsageSummary,
  UsageBucket,
  UsageHistory,
  UsageParams,
  HistoryParams,
  CurrentUsage,
  UsageAlert,
  UsageAnomaly,
} from './types/usage.js';
export { UsagePeriod, UsageGranularity } from './types/usage.js';

// Entitlements & Tiers Types
export type {
  ResourceLimits,
  TierFeatures,
  Entitlements,
  TierInfo,
  ChangeTierParams,
  ChangeTierResult,
  QuotaOverride,
  ListTiersResponse,
  EntitlementGrant,
} from './types/entitlements.js';
export { EntitlementTier } from './types/entitlements.js';

// Layer 3 Core Types
export type {
  HttpMethod,
  Layer3Route,
  CoreHealth,
  CoreConfig,
  RouteMatch,
  CoreCapabilities,
  ProxyRequest,
  ProxyResponse,
  CoreRegistry,
} from './types/layer3.js';
export { Layer3Core } from './types/layer3.js';

// Coherence Domain Types (ADR/DDD #005)
export type {
  // Drift Domain
  DriftFinding,
  DriftSource,
  DriftState,
  // Coherence Domain
  CoherenceAssessment,
  CoherenceSummary,
  AssessmentScope,
  // Lineage Domain
  LineageRecord,
  ArtifactReference,
  DerivationOperation,
  GovernanceContext,
  // Human Oversight Domain
  DecisionRecord,
  DecisionSubject,
  ImpactAssessment,
  DecisionContext,
  HistoricalContext,
  IntegrationState,
  PrecedentDecision,
  DecisionAuditEntry,
  // Invariant Types
  SystemInvariant,
  InvariantValidationResult,
  InvariantViolation,
  // Alert Types
  CoherenceAlert,
  AlertSource,
  // Comparison Types
  StateDiff,
  StateSnapshot,
  Difference,
  DiffSummary,
} from './types/coherence.js';
export {
  DriftType,
  DriftSeverity,
  CoherenceStatus,
  ArtifactType,
  DecisionCategory,
  DecisionStatus,
  InvariantCategory,
  AlertType,
} from './types/coherence.js';

// Intent Domain Types (ADR/DDD #006)
export type {
  // Core Intent Types
  Intent,
  IntentOperation,
  ControlSurfaceWorkflow,
  WorkflowTransition,
  // Governance Types
  GovernanceValidationResult,
  GovernanceConstraint,
  GovernanceWarning,
  // Confirmation Types
  ConfirmationRequirement,
  ConfirmationStep,
  ConfirmationAcknowledgment,
  // Preview Types
  PreviewData,
  ProposedChange,
  ImpactSummary,
  AffectedResource,
  // Execution Types
  ExecutionResult,
  ExecutionError,
  ActualChange,
  // Audit Types
  IntentAuditEntry,
  IntentAuditAction,
  // Request/Response Types
  DeclareIntentRequest,
  ConfirmIntentRequest,
  ExecuteIntentRequest,
  CancelIntentRequest,
} from './types/intent.js';
export {
  IntentCategory,
  IntentStatus,
  WorkflowPhase,
  EntryPoint,
  IntentDomain,
  ConfirmationType,
} from './types/intent.js';

// Constants
export {
  API_VERSION,
  LAYER3_ROUTES,
  SCOPE_REQUIREMENTS,
  DEFAULT_RATE_LIMITS,
  DEFAULT_BURST_LIMITS,
  DEFAULT_TIMEOUTS,
  PAGINATION_DEFAULTS,
  TOKEN_LIMITS,
  CACHE_TTL,
  HTTP_STATUS,
  ERROR_MESSAGES,
  // URL Configuration (Single Source of Truth)
  AGENTICS_DOMAIN,
  URL_PATTERNS,
  URL_ENV_VARS,
  validateUrl,
  getPlatformUrl,
  getApiUrl,
  isAgenticsDomain,
  createCliAuthUrl,
} from './constants/index.js';
export type { UrlValidationResult } from './constants/index.js';
