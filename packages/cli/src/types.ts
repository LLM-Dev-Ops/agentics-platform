/**
 * Types for Agentics CLI
 *
 * Self-contained type definitions for CLI operations.
 * Based on the Layer 4 Agentics Platform API specification.
 */

// ============================================================================
// API Types
// ============================================================================

/**
 * Standard error response structure returned by all API endpoints
 */
export interface ErrorResponse {
  /** Human-readable error message */
  error: string;
  /** Machine-readable error code for programmatic handling */
  code: string;
  /** Unique identifier for this request, useful for debugging and support */
  request_id: string;
  /** Optional additional context about the error */
  details?: Record<string, unknown>;
}

// ============================================================================
// Identity Types
// ============================================================================

/**
 * Authentication credentials for login
 */
export interface AuthCredentials {
  /** User's email address (for email/password auth) */
  email?: string;
  /** User's password (for email/password auth) */
  password?: string;
  /** API key for programmatic access */
  api_key?: string;
}

/**
 * Result of successful authentication
 */
export interface AuthResult {
  /** JWT token for authenticated requests */
  token: string;
  /** ISO 8601 timestamp when the token expires */
  expires_at: string;
  /** Scopes granted to this token */
  scopes: Scope[];
}

/**
 * User identity and associated metadata
 */
export interface Identity {
  /** Unique user identifier */
  user_id: string;
  /** User's email address */
  email: string;
  /** Scopes granted to this user */
  scopes: Scope[];
  /** Current usage statistics */
  usage: {
    requests: number;
    tokens: number;
    compute_seconds: number;
  };
  /** ISO 8601 timestamp of account creation */
  created_at?: string;
  /** User's current entitlement tier */
  tier?: string;
}

/**
 * API key for programmatic access
 */
export interface ApiKey {
  /** Unique identifier for this API key */
  id: string;
  /** Human-readable name for this key */
  name: string;
  /** Scopes granted to this API key */
  scopes: Scope[];
  /** ISO 8601 timestamp when the key was created */
  created_at: string;
  /** ISO 8601 timestamp when the key expires (optional) */
  expires_at?: string;
  /** Whether this key has been revoked */
  revoked: boolean;
  /** Last 4 characters of the key for identification */
  key_preview?: string;
}

/**
 * Parameters for creating a new API key
 */
export interface CreateApiKeyParams {
  /** Human-readable name for this key */
  name: string;
  /** Scopes to grant to this API key */
  scopes: Scope[];
  /** Optional expiration date (ISO 8601 timestamp) */
  expires_at?: string;
}

/**
 * Response when creating a new API key
 */
export interface CreateApiKeyResponse {
  /** The created API key metadata */
  api_key: ApiKey;
  /** The full API key value (only returned on creation) */
  key: string;
}

/**
 * All available scopes in the platform
 */
export enum Scope {
  IDENTITY_READ = 'identity:read',
  IDENTITY_WRITE = 'identity:write',
  INTELLIGENCE_READ = 'intelligence:read',
  INTELLIGENCE_WRITE = 'intelligence:write',
  SECURITY_READ = 'security:read',
  SECURITY_WRITE = 'security:write',
  AUTOMATION_READ = 'automation:read',
  AUTOMATION_WRITE = 'automation:write',
  GOVERNANCE_READ = 'governance:read',
  GOVERNANCE_WRITE = 'governance:write',
  DATA_READ = 'data:read',
  DATA_WRITE = 'data:write',
  ECOSYSTEM_READ = 'ecosystem:read',
  ECOSYSTEM_WRITE = 'ecosystem:write',
  RESEARCH_READ = 'research:read',
  RESEARCH_WRITE = 'research:write',
  ADMIN_ALL = 'admin:*',
}

/**
 * List API keys response
 */
export interface ListApiKeysResponse {
  /** Array of API keys */
  api_keys: ApiKey[];
}

// ============================================================================
// Simulation Types
// ============================================================================

/**
 * Parameters for starting a simulation
 */
export interface SimulateParams {
  /** Prompt or configuration for the simulation */
  prompt?: string;
  /** Model to use for simulation */
  model?: string;
  /** Additional parameters */
  [key: string]: unknown;
}

/**
 * Result of a simulation
 */
export interface SimulationResult {
  /** Unique simulation identifier */
  simulation_id: string;
  /** Current status */
  status: string;
  /** Results when complete */
  results?: unknown;
}

/**
 * Status of a running simulation
 */
export interface SimulationStatus {
  /** Unique simulation identifier */
  simulation_id: string;
  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Progress percentage (0-100) */
  progress?: number;
  /** Results when complete */
  results?: unknown;
  /** Error message if failed */
  error?: string;
  /** Current step information */
  current_step?: string;
  /** Last updated timestamp */
  updated_at?: string;
}

// ============================================================================
// Intelligence Types
// ============================================================================

/**
 * Parameters for creating a completion
 */
export interface CompletionParams {
  /** The prompt to complete */
  prompt: string;
  /** Model to use */
  model?: string;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Temperature for sampling */
  temperature?: number;
  /** Additional parameters */
  [key: string]: unknown;
}

/**
 * A generated completion
 */
export interface Completion {
  /** Unique completion identifier */
  id: string;
  /** The generated text */
  text?: string;
  /** The completion text (alternative field name) */
  completion?: string;
  /** Model used */
  model: string;
  /** Token usage */
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Available models response
 */
export interface ListModelsResponse {
  /** Available models */
  models: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

// ============================================================================
// Usage Types
// ============================================================================

/**
 * Usage period options
 */
export type UsagePeriod = 'day' | 'week' | 'month' | 'year';

/**
 * Usage granularity options
 */
export type UsageGranularity = 'hour' | 'day' | 'week' | 'month';

/**
 * Parameters for usage queries
 */
export interface UsageParams {
  /** Period to query */
  period?: UsagePeriod;
  /** Break down by resource */
  by_resource?: boolean;
  /** Break down by core */
  by_core?: boolean;
}

/**
 * Usage summary
 */
export interface UsageSummary {
  /** Total requests */
  total_requests: number;
  /** Total tokens */
  total_tokens: number;
  /** Total compute seconds */
  total_compute_seconds: number;
  /** Breakdown by resource (if requested) */
  by_resource?: Record<string, number>;
  /** Breakdown by core (if requested) */
  by_core?: Record<string, number>;
  /** Period name */
  period?: string;
  /** Period start */
  period_start?: string;
  /** Period end */
  period_end?: string;
  /** Requests count */
  requests?: number;
  /** Tokens count */
  tokens?: number;
  /** Compute seconds */
  compute_seconds?: number;
}

/**
 * Parameters for usage history
 */
export interface HistoryParams {
  /** Start date (ISO 8601) */
  start: string;
  /** End date (ISO 8601) */
  end: string;
  /** Granularity */
  granularity: UsageGranularity;
  /** Filter by resource */
  resource?: string;
  /** Filter by core */
  core?: string;
}

/**
 * Usage history data point
 */
export interface UsageDataPoint {
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Request count */
  requests: number;
  /** Token count */
  tokens: number;
  /** Compute seconds */
  compute_seconds: number;
}

/**
 * Usage history response
 */
export interface UsageHistory {
  /** Data points */
  data: UsageDataPoint[];
  /** Query parameters */
  params: HistoryParams;
  /** Granularity */
  granularity?: string;
  /** Start date */
  start_date?: string;
  /** End date */
  end_date?: string;
  /** Time buckets */
  buckets?: Array<{
    timestamp: string;
    requests: number;
    tokens: number;
    compute_seconds: number;
  }>;
  /** Totals */
  totals?: {
    requests: number;
    tokens: number;
    compute_seconds: number;
  };
}

/**
 * Current usage stats
 */
export interface CurrentUsage {
  /** Requests in current period */
  requests: number;
  /** Tokens in current period */
  tokens: number;
  /** Compute seconds in current period */
  compute_seconds: number;
  /** Period start (ISO 8601) */
  period_start: string;
  /** Period end (ISO 8601) */
  period_end: string;
  /** Current requests */
  requests_current?: number;
  /** Request limit */
  requests_limit?: number;
  /** Percent used */
  requests_used_percent?: number;
  /** Current tokens */
  tokens_current?: number;
  /** Token limit */
  tokens_limit?: number;
  /** Token percent used */
  tokens_used_percent?: number;
  /** Current compute seconds */
  compute_seconds_current?: number;
  /** Compute limit */
  compute_seconds_limit?: number;
  /** Compute percent used */
  compute_seconds_used_percent?: number;
  /** Reset timestamp */
  resets_at?: string;
}
