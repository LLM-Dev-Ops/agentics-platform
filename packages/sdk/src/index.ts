/**
 * @agentics/sdk - TypeScript SDK for the Agentics Platform
 *
 * Main entry point for the SDK
 */

// Main client
export { AgenticsClient, type AgenticsClientOptions } from './client';

// Error classes
export {
  AgenticsError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  QuotaExceededError,
  InvalidRequestError,
  UpstreamError,
  type ErrorResponse,
} from './errors';

// Identity types
export type {
  AuthCredentials,
  AuthResult,
  Identity,
  ApiKey,
  CreateApiKeyParams,
} from './resources/identity';

// Simulate types
export type {
  SimulateParams,
  SimulationResult,
  SimulationStatus,
  SimulationEvent,
} from './resources/simulate';

// Intelligence types
export type {
  CompletionParams,
  Completion,
  CompletionChunk,
  EmbeddingParams,
  Embeddings,
  Model,
} from './resources/intelligence';

// Security types
export type {
  ScanParams,
  ScanResult,
  Threat,
  Policy,
} from './resources/security';

// Automation types
export type {
  Workflow,
  CreateWorkflowParams,
  WorkflowRun,
  WorkflowStatus,
} from './resources/automation';

// Governance types
export type {
  ValidateParams,
  ValidationResult,
  GovernancePolicy,
} from './resources/governance';

// Data types
export type {
  QueryParams,
  QueryResult,
  CatalogEntry,
} from './resources/data';

// Ecosystem types
export type {
  Integration,
  ConnectParams,
  Connection,
  MarketplaceItem,
} from './resources/ecosystem';

// Research types
export type {
  CreateExperimentParams,
  Experiment,
  Results,
} from './resources/research';

// Usage types
export type {
  UsageQueryParams,
  UsageSummary,
  UsageHistory,
  UsageHistoryEntry,
} from './resources/usage';

// Default export
export { AgenticsClient as default } from './client';