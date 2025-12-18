/**
 * Layer 3 Core Types for Layer 4 Agentics Platform
 *
 * Types for routing and mapping to Layer 3 cores as defined
 * in the SPARC specification.
 */

/**
 * Layer 3 core systems in the platform
 * Each core represents a fundamental capability domain
 */
export enum Layer3Core {
  /** Intelligence - AI/ML models and cognitive services */
  INTELLIGENCE = 'INTELLIGENCE',
  /** Security - Authentication, authorization, and threat protection */
  SECURITY = 'SECURITY',
  /** Automation - Workflow orchestration and task automation */
  AUTOMATION = 'AUTOMATION',
  /** Governance - Policy enforcement and compliance */
  GOVERNANCE = 'GOVERNANCE',
  /** Data - Data management, storage, and analytics */
  DATA = 'DATA',
  /** Ecosystem - Third-party integrations and marketplace */
  ECOSYSTEM = 'ECOSYSTEM',
  /** Research - Knowledge discovery and experimentation */
  RESEARCH = 'RESEARCH',
  /** Interface - User interface and experience layer */
  INTERFACE = 'INTERFACE',
}

/**
 * HTTP methods supported by routes
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Route definition mapping Layer 4 endpoint to Layer 3 core
 */
export interface Layer3Route {
  /** URL pattern for this route (supports :params) */
  pattern: string;
  /** Layer 3 core that handles this route */
  core: Layer3Core;
  /** HTTP methods supported by this route */
  methods: HttpMethod[];
  /** Optional description of what this route does */
  description?: string;
  /** Whether authentication is required */
  requires_auth?: boolean;
  /** Required scopes for this route */
  required_scopes?: string[];
  /** Whether this route is deprecated */
  deprecated?: boolean;
  /** Version when route was introduced */
  since_version?: string;
}

/**
 * Layer 3 core health status
 */
export interface CoreHealth {
  /** Core identifier */
  core: Layer3Core;
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Response time in milliseconds */
  response_time_ms?: number;
  /** Last health check timestamp */
  last_check: string;
  /** Error message if unhealthy */
  error?: string;
  /** Detailed metrics */
  metrics?: {
    /** CPU usage percentage */
    cpu_percent?: number;
    /** Memory usage percentage */
    memory_percent?: number;
    /** Active connections */
    connections?: number;
    /** Request queue depth */
    queue_depth?: number;
  };
}

/**
 * Layer 3 core configuration
 */
export interface CoreConfig {
  /** Core identifier */
  core: Layer3Core;
  /** Base URL for this core's API */
  base_url: string;
  /** Whether this core is enabled */
  enabled: boolean;
  /** Timeout for requests to this core (ms) */
  timeout_ms?: number;
  /** Maximum retry attempts */
  max_retries?: number;
  /** Circuit breaker configuration */
  circuit_breaker?: {
    /** Threshold for opening circuit */
    failure_threshold: number;
    /** Time window in seconds */
    window_seconds: number;
    /** Cooldown before retry in seconds */
    cooldown_seconds: number;
  };
  /** Custom headers to send to this core */
  custom_headers?: Record<string, string>;
}

/**
 * Request routing information
 */
export interface RouteMatch {
  /** Matched route definition */
  route: Layer3Route;
  /** Extracted path parameters */
  params: Record<string, string>;
  /** Target Layer 3 core */
  core: Layer3Core;
}

/**
 * Core capabilities and features
 */
export interface CoreCapabilities {
  /** Core identifier */
  core: Layer3Core;
  /** Available features */
  features: string[];
  /** API version */
  version: string;
  /** Supported content types */
  content_types?: string[];
  /** Maximum request size in bytes */
  max_request_size?: number;
  /** Whether streaming is supported */
  supports_streaming?: boolean;
  /** Whether webhooks are supported */
  supports_webhooks?: boolean;
}

/**
 * Layer 3 proxy request
 */
export interface ProxyRequest {
  /** Target core */
  core: Layer3Core;
  /** HTTP method */
  method: HttpMethod;
  /** Path within the core */
  path: string;
  /** Query parameters */
  query?: Record<string, string | string[]>;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Timeout override in milliseconds */
  timeout_ms?: number;
}

/**
 * Layer 3 proxy response
 */
export interface ProxyResponse {
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body */
  body: unknown;
  /** Response time in milliseconds */
  response_time_ms: number;
  /** Which core handled the request */
  core: Layer3Core;
}

/**
 * Core registry for dynamic discovery
 */
export interface CoreRegistry {
  /** Available cores */
  cores: Record<Layer3Core, CoreConfig>;
  /** Last update timestamp */
  updated_at: string;
}
