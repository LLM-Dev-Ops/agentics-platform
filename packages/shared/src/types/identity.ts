/**
 * Identity and Authentication Types for Layer 4 Agentics Platform
 *
 * Authentication, authorization, and API key management types
 * as defined in the SPARC specification.
 */

/**
 * Authentication credentials for login
 * Supports either email/password or API key authentication
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
    /** Number of requests made in current period */
    requests: number;
    /** Number of tokens consumed in current period */
    tokens: number;
    /** Compute seconds used in current period */
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
  /** Last 4 characters of the key for identification (full key only shown on creation) */
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
 * Contains the full key value which is only shown once
 */
export interface CreateApiKeyResponse {
  /** The created API key metadata */
  api_key: ApiKey;
  /** The full API key value (only returned on creation) */
  key: string;
}

/**
 * All available scopes in the platform
 * Organized by Layer 3 core with read/write permissions
 */
export enum Scope {
  /** Read user identity and profile */
  IDENTITY_READ = 'identity:read',
  /** Modify user identity and settings */
  IDENTITY_WRITE = 'identity:write',

  /** Access intelligence/AI services */
  INTELLIGENCE_READ = 'intelligence:read',
  /** Train or modify AI models */
  INTELLIGENCE_WRITE = 'intelligence:write',

  /** View security policies and audit logs */
  SECURITY_READ = 'security:read',
  /** Modify security policies */
  SECURITY_WRITE = 'security:write',

  /** View automation workflows */
  AUTOMATION_READ = 'automation:read',
  /** Create and modify automation workflows */
  AUTOMATION_WRITE = 'automation:write',

  /** View governance policies */
  GOVERNANCE_READ = 'governance:read',
  /** Modify governance policies */
  GOVERNANCE_WRITE = 'governance:write',

  /** Read data and datasets */
  DATA_READ = 'data:read',
  /** Write and modify data */
  DATA_WRITE = 'data:write',

  /** View ecosystem integrations */
  ECOSYSTEM_READ = 'ecosystem:read',
  /** Manage ecosystem integrations */
  ECOSYSTEM_WRITE = 'ecosystem:write',

  /** Access research services */
  RESEARCH_READ = 'research:read',
  /** Conduct and manage research */
  RESEARCH_WRITE = 'research:write',

  /** Administrative access to all resources */
  ADMIN_ALL = 'admin:*',
}

/**
 * Request to revoke an API key
 */
export interface RevokeApiKeyParams {
  /** ID of the API key to revoke */
  key_id: string;
}

/**
 * List API keys response
 */
export interface ListApiKeysResponse {
  /** Array of API keys */
  api_keys: ApiKey[];
}

// ============================================================================
// CLI Authentication Types (Browser-based device flow)
// ============================================================================

/**
 * CLI auth session status
 * Tracks the lifecycle of a CLI authentication request
 */
export type CliAuthSessionStatus = 'pending' | 'authorized' | 'completed' | 'expired' | 'cancelled';

/**
 * Request to create a new CLI auth session
 * Sent by CLI when initiating browser-based auth
 */
export interface CreateCliAuthSessionRequest {
  /** Name of the CLI tool */
  cli_name?: string;
  /** Version of the CLI tool */
  cli_version?: string;
  /** Hostname of the machine running the CLI */
  hostname?: string;
  /** Scopes requested by the CLI */
  scopes?: string[];
}

/**
 * Response when creating a CLI auth session
 * Contains codes for browser verification and CLI polling
 */
export interface CreateCliAuthSessionResponse {
  /** Short code displayed in browser URL for user verification */
  session_code: string;
  /** Secret code used by CLI to poll for session completion */
  device_code: string;
  /** Full URL for user to visit in browser */
  verification_url: string;
  /** ISO 8601 timestamp when the session expires */
  expires_at: string;
  /** Number of seconds until expiration */
  expires_in_seconds: number;
  /** Recommended polling interval in seconds */
  poll_interval_seconds: number;
  /** Human-readable message for display */
  message: string;
}

/**
 * CLI auth session information
 * Returned when browser requests session details
 */
export interface CliAuthSessionInfo {
  /** Session code for display */
  session_code: string;
  /** Name of the CLI tool */
  cli_name: string;
  /** Version of the CLI tool */
  cli_version?: string;
  /** Hostname of the requesting machine */
  hostname?: string;
  /** IP address of the requesting machine */
  ip_address?: string;
  /** Scopes requested by the CLI */
  requested_scopes: string[];
  /** ISO 8601 timestamp when session was created */
  created_at: string;
  /** ISO 8601 timestamp when session expires */
  expires_at: string;
}

/**
 * Response when CLI polls for session status
 */
export interface CliAuthPollResponse {
  /** Current status of the session */
  status: CliAuthSessionStatus;
  /** API key (only present when status is 'completed') */
  api_key?: string;
  /** Human-readable message */
  message: string;
}

/**
 * Request to authorize a CLI session
 * Sent by browser after user authenticates
 */
export interface AuthorizeCliSessionRequest {
  /** Custom name for the API key */
  key_name?: string;
  /** Override scopes (must be subset of requested scopes) */
  scopes?: string[];
}

/**
 * Response after authorizing a CLI session
 */
export interface AuthorizeCliSessionResponse {
  /** Whether authorization was successful */
  success: boolean;
  /** Human-readable message */
  message: string;
  /** Created API key metadata (plaintext key is sent to CLI via polling) */
  api_key?: {
    id: string;
    name: string;
    scopes: string[];
    created_at: string;
  };
}
