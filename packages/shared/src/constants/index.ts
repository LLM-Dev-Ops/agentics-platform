/**
 * Constants for Layer 4 Agentics Platform
 *
 * Route mappings, scope requirements, rate limits, and other
 * configuration constants as defined in the SPARC specification.
 */

import { Layer3Core, type Layer3Route } from '../types/layer3.js';
import { Scope } from '../types/identity.js';
import { EntitlementTier } from '../types/entitlements.js';

/**
 * API Version
 */
export const API_VERSION = 'v1';

/**
 * Layer 3 route mappings
 * Maps API endpoint patterns to their corresponding Layer 3 core
 */
export const LAYER3_ROUTES: Layer3Route[] = [
  // Identity & Authentication (Security Core)
  {
    pattern: '/auth/login',
    core: Layer3Core.SECURITY,
    methods: ['POST'],
    description: 'Authenticate user and receive token',
    requires_auth: false,
  },
  {
    pattern: '/auth/logout',
    core: Layer3Core.SECURITY,
    methods: ['POST'],
    description: 'Invalidate current session',
    requires_auth: true,
  },
  {
    pattern: '/identity',
    core: Layer3Core.SECURITY,
    methods: ['GET', 'PUT'],
    description: 'Get or update user identity',
    requires_auth: true,
    required_scopes: [Scope.IDENTITY_READ],
  },
  {
    pattern: '/identity/api-keys',
    core: Layer3Core.SECURITY,
    methods: ['GET', 'POST'],
    description: 'List or create API keys',
    requires_auth: true,
    required_scopes: [Scope.IDENTITY_READ, Scope.IDENTITY_WRITE],
  },
  {
    pattern: '/identity/api-keys/:key_id',
    core: Layer3Core.SECURITY,
    methods: ['GET', 'DELETE'],
    description: 'Get or revoke specific API key',
    requires_auth: true,
    required_scopes: [Scope.IDENTITY_READ, Scope.IDENTITY_WRITE],
  },

  // Usage & Entitlements (Governance Core)
  {
    pattern: '/usage',
    core: Layer3Core.GOVERNANCE,
    methods: ['GET'],
    description: 'Get usage summary',
    requires_auth: true,
    required_scopes: [Scope.IDENTITY_READ],
  },
  {
    pattern: '/usage/history',
    core: Layer3Core.GOVERNANCE,
    methods: ['GET'],
    description: 'Get historical usage data',
    requires_auth: true,
    required_scopes: [Scope.IDENTITY_READ],
  },
  {
    pattern: '/entitlements',
    core: Layer3Core.GOVERNANCE,
    methods: ['GET'],
    description: 'Get current entitlements',
    requires_auth: true,
    required_scopes: [Scope.IDENTITY_READ],
  },
  {
    pattern: '/entitlements/tiers',
    core: Layer3Core.GOVERNANCE,
    methods: ['GET'],
    description: 'List available tiers',
    requires_auth: false,
  },

  // Intelligence (Intelligence Core)
  {
    pattern: '/intelligence/completions',
    core: Layer3Core.INTELLIGENCE,
    methods: ['POST'],
    description: 'Generate text completion',
    requires_auth: true,
    required_scopes: [Scope.INTELLIGENCE_READ],
  },
  {
    pattern: '/intelligence/embeddings',
    core: Layer3Core.INTELLIGENCE,
    methods: ['POST'],
    description: 'Generate embeddings',
    requires_auth: true,
    required_scopes: [Scope.INTELLIGENCE_READ],
  },
  {
    pattern: '/intelligence/models',
    core: Layer3Core.INTELLIGENCE,
    methods: ['GET'],
    description: 'List available models',
    requires_auth: true,
    required_scopes: [Scope.INTELLIGENCE_READ],
  },
  {
    pattern: '/intelligence/models/:model_id',
    core: Layer3Core.INTELLIGENCE,
    methods: ['GET'],
    description: 'Get model details',
    requires_auth: true,
    required_scopes: [Scope.INTELLIGENCE_READ],
  },

  // Simulation (Research Core)
  {
    pattern: '/simulate',
    core: Layer3Core.RESEARCH,
    methods: ['POST'],
    description: 'Create new simulation',
    requires_auth: true,
    required_scopes: [Scope.RESEARCH_WRITE],
  },
  {
    pattern: '/simulations/:simulation_id',
    core: Layer3Core.RESEARCH,
    methods: ['GET', 'DELETE'],
    description: 'Get or cancel simulation',
    requires_auth: true,
    required_scopes: [Scope.RESEARCH_READ],
  },
  {
    pattern: '/simulations/:simulation_id/status',
    core: Layer3Core.RESEARCH,
    methods: ['GET'],
    description: 'Get simulation status',
    requires_auth: true,
    required_scopes: [Scope.RESEARCH_READ],
  },
  {
    pattern: '/simulations',
    core: Layer3Core.RESEARCH,
    methods: ['GET'],
    description: 'List all simulations',
    requires_auth: true,
    required_scopes: [Scope.RESEARCH_READ],
  },

  // Automation (Automation Core)
  {
    pattern: '/automation/workflows',
    core: Layer3Core.AUTOMATION,
    methods: ['GET', 'POST'],
    description: 'List or create workflows',
    requires_auth: true,
    required_scopes: [Scope.AUTOMATION_READ, Scope.AUTOMATION_WRITE],
  },
  {
    pattern: '/automation/workflows/:workflow_id',
    core: Layer3Core.AUTOMATION,
    methods: ['GET', 'PUT', 'DELETE'],
    description: 'Manage specific workflow',
    requires_auth: true,
    required_scopes: [Scope.AUTOMATION_READ, Scope.AUTOMATION_WRITE],
  },
  {
    pattern: '/automation/workflows/:workflow_id/execute',
    core: Layer3Core.AUTOMATION,
    methods: ['POST'],
    description: 'Execute workflow',
    requires_auth: true,
    required_scopes: [Scope.AUTOMATION_WRITE],
  },

  // Data (Data Core)
  {
    pattern: '/data/datasets',
    core: Layer3Core.DATA,
    methods: ['GET', 'POST'],
    description: 'List or create datasets',
    requires_auth: true,
    required_scopes: [Scope.DATA_READ, Scope.DATA_WRITE],
  },
  {
    pattern: '/data/datasets/:dataset_id',
    core: Layer3Core.DATA,
    methods: ['GET', 'PUT', 'DELETE'],
    description: 'Manage specific dataset',
    requires_auth: true,
    required_scopes: [Scope.DATA_READ, Scope.DATA_WRITE],
  },

  // Ecosystem (Ecosystem Core)
  {
    pattern: '/ecosystem/integrations',
    core: Layer3Core.ECOSYSTEM,
    methods: ['GET', 'POST'],
    description: 'List or create integrations',
    requires_auth: true,
    required_scopes: [Scope.ECOSYSTEM_READ, Scope.ECOSYSTEM_WRITE],
  },
  {
    pattern: '/ecosystem/integrations/:integration_id',
    core: Layer3Core.ECOSYSTEM,
    methods: ['GET', 'PUT', 'DELETE'],
    description: 'Manage specific integration',
    requires_auth: true,
    required_scopes: [Scope.ECOSYSTEM_READ, Scope.ECOSYSTEM_WRITE],
  },

  // Health & Status
  {
    pattern: '/health',
    core: Layer3Core.GOVERNANCE,
    methods: ['GET'],
    description: 'System health check',
    requires_auth: false,
  },
];

/**
 * Scope requirements for endpoints
 * Maps endpoint patterns to required scopes for access
 */
export const SCOPE_REQUIREMENTS: Record<string, Scope[]> = {
  // Identity
  'GET /identity': [Scope.IDENTITY_READ],
  'PUT /identity': [Scope.IDENTITY_WRITE],
  'GET /identity/api-keys': [Scope.IDENTITY_READ],
  'POST /identity/api-keys': [Scope.IDENTITY_WRITE],
  'DELETE /identity/api-keys/:key_id': [Scope.IDENTITY_WRITE],

  // Intelligence
  'POST /intelligence/completions': [Scope.INTELLIGENCE_READ],
  'POST /intelligence/embeddings': [Scope.INTELLIGENCE_READ],
  'GET /intelligence/models': [Scope.INTELLIGENCE_READ],

  // Simulation
  'POST /simulate': [Scope.RESEARCH_WRITE],
  'GET /simulations/:simulation_id': [Scope.RESEARCH_READ],
  'DELETE /simulations/:simulation_id': [Scope.RESEARCH_WRITE],

  // Automation
  'GET /automation/workflows': [Scope.AUTOMATION_READ],
  'POST /automation/workflows': [Scope.AUTOMATION_WRITE],
  'PUT /automation/workflows/:workflow_id': [Scope.AUTOMATION_WRITE],
  'DELETE /automation/workflows/:workflow_id': [Scope.AUTOMATION_WRITE],
  'POST /automation/workflows/:workflow_id/execute': [Scope.AUTOMATION_WRITE],

  // Data
  'GET /data/datasets': [Scope.DATA_READ],
  'POST /data/datasets': [Scope.DATA_WRITE],
  'PUT /data/datasets/:dataset_id': [Scope.DATA_WRITE],
  'DELETE /data/datasets/:dataset_id': [Scope.DATA_WRITE],

  // Ecosystem
  'GET /ecosystem/integrations': [Scope.ECOSYSTEM_READ],
  'POST /ecosystem/integrations': [Scope.ECOSYSTEM_WRITE],
  'PUT /ecosystem/integrations/:integration_id': [Scope.ECOSYSTEM_WRITE],
  'DELETE /ecosystem/integrations/:integration_id': [Scope.ECOSYSTEM_WRITE],

  // Governance
  'GET /governance/policies': [Scope.GOVERNANCE_READ],
  'POST /governance/policies': [Scope.GOVERNANCE_WRITE],

  // Security
  'GET /security/audit-logs': [Scope.SECURITY_READ],
  'POST /security/policies': [Scope.SECURITY_WRITE],
};

/**
 * Default rate limits per tier (requests per second)
 */
export const DEFAULT_RATE_LIMITS: Record<EntitlementTier, number> = {
  [EntitlementTier.FREE]: 10,
  [EntitlementTier.DEVELOPER]: 50,
  [EntitlementTier.TEAM]: 200,
  [EntitlementTier.ENTERPRISE]: 1000,
};

/**
 * Default burst limits per tier (maximum concurrent requests)
 */
export const DEFAULT_BURST_LIMITS: Record<EntitlementTier, number> = {
  [EntitlementTier.FREE]: 20,
  [EntitlementTier.DEVELOPER]: 100,
  [EntitlementTier.TEAM]: 500,
  [EntitlementTier.ENTERPRISE]: 2000,
};

/**
 * Default timeout values (milliseconds)
 */
export const DEFAULT_TIMEOUTS = {
  /** Standard API request timeout */
  API_REQUEST: 30000,
  /** Long-running operation timeout */
  LONG_OPERATION: 300000,
  /** Streaming request timeout */
  STREAMING: 600000,
  /** Health check timeout */
  HEALTH_CHECK: 5000,
};

/**
 * Pagination defaults
 */
export const PAGINATION_DEFAULTS = {
  /** Default page size */
  DEFAULT_LIMIT: 20,
  /** Maximum page size */
  MAX_LIMIT: 100,
  /** Default offset */
  DEFAULT_OFFSET: 0,
};

/**
 * Token limits for AI models
 */
export const TOKEN_LIMITS = {
  /** Maximum tokens for standard completion */
  MAX_COMPLETION_TOKENS: 4096,
  /** Maximum tokens for extended completion */
  MAX_EXTENDED_TOKENS: 32768,
  /** Default max tokens if not specified */
  DEFAULT_MAX_TOKENS: 1024,
};

/**
 * Cache TTL values (seconds)
 */
export const CACHE_TTL = {
  /** User session cache */
  SESSION: 3600,
  /** API key cache */
  API_KEY: 300,
  /** Model list cache */
  MODELS: 3600,
  /** Health status cache */
  HEALTH: 60,
  /** Entitlements cache */
  ENTITLEMENTS: 300,
};

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Standard error messages
 */
export const ERROR_MESSAGES = {
  AUTHENTICATION_REQUIRED: 'Authentication credentials are required',
  AUTHORIZATION_DENIED: 'Insufficient permissions to access this resource',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later',
  QUOTA_EXCEEDED: 'Monthly quota exceeded. Please upgrade your plan',
  INVALID_REQUEST: 'Request validation failed',
  UPSTREAM_ERROR: 'Error communicating with upstream service',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource already exists',
} as const;
