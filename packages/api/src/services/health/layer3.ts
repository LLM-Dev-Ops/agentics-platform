/**
 * Layer 3 Health Service
 *
 * Provides health check functionality for all Layer 3 core services.
 * Each check performs a direct HTTP GET to the Layer 3 /health endpoint,
 * measures latency, and returns a normalized response.
 *
 * Design principles:
 * - 1 second timeout per upstream call
 * - No retries
 * - No exception throwing
 * - No header or error passthrough
 * - Failures captured as structured degraded states
 */

import config, { Layer3Endpoints } from '../../config.js';

/**
 * Health status values for Layer 3 services
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unreachable';

/**
 * Normalized health check response for a single Layer 3 service
 */
export interface Layer3HealthResponse {
  service: string;
  status: HealthStatus;
  latencyMs: number;
  timestamp: string;
}

/**
 * Aggregated health response for all Layer 3 services
 */
export interface AggregatedHealthResponse {
  status: HealthStatus;
  timestamp: string;
  services: Layer3HealthResponse[];
}

/**
 * Layer 3 service name mapping
 */
export type Layer3ServiceName = keyof Layer3Endpoints;

/**
 * Service display names for responses
 */
const SERVICE_DISPLAY_NAMES: Record<Layer3ServiceName, string> = {
  intelligence: 'intelligence-core',
  security: 'security-core',
  automation: 'automation-core',
  governance: 'governance-core',
  data: 'data-core',
  ecosystem: 'ecosystem-core',
  research: 'research-core',
  interface: 'interface-core',
  orchestration: 'agentics-orchestration-engine',
  resultsIndex: 'agentics-results-index',
  simulationRunner: 'agentics-simulation-runner',
};

/**
 * Timeout for upstream health checks in milliseconds
 */
const HEALTH_CHECK_TIMEOUT_MS = 1000;

/**
 * Check health of a single Layer 3 service
 *
 * Performs HTTP GET to {baseUrl}/health with a 1 second timeout.
 * Returns structured response regardless of success/failure.
 * Never throws exceptions.
 *
 * @param serviceName - The Layer 3 service identifier
 * @param baseUrl - The base URL of the Layer 3 service
 * @returns Normalized health check response
 */
export async function checkServiceHealth(
  serviceName: Layer3ServiceName,
  baseUrl: string
): Promise<Layer3HealthResponse> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const displayName = SERVICE_DISPLAY_NAMES[serviceName];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    // Determine status based on HTTP response
    if (response.ok) {
      // Try to parse response to verify it's a valid health response
      try {
        const body = await response.json() as { status?: string };
        // Check if the service reports itself as healthy
        const serviceStatus = body.status?.toLowerCase();
        if (serviceStatus === 'healthy' || serviceStatus === 'ok' || serviceStatus === 'up') {
          return {
            service: displayName,
            status: 'healthy',
            latencyMs,
            timestamp,
          };
        }
        // Service responded but reports degraded state
        return {
          service: displayName,
          status: 'degraded',
          latencyMs,
          timestamp,
        };
      } catch {
        // Response not valid JSON but HTTP was OK - consider degraded
        return {
          service: displayName,
          status: 'degraded',
          latencyMs,
          timestamp,
        };
      }
    }

    // Non-2xx response - service is degraded
    return {
      service: displayName,
      status: 'degraded',
      latencyMs,
      timestamp,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // Any error (timeout, network, etc.) means unreachable
    return {
      service: displayName,
      status: 'unreachable',
      latencyMs,
      timestamp,
    };
  }
}

/**
 * Check health of a specific Layer 3 service by name
 *
 * @param serviceName - The Layer 3 service to check
 * @returns Normalized health check response
 */
export async function checkLayer3Service(
  serviceName: Layer3ServiceName
): Promise<Layer3HealthResponse> {
  const baseUrl = config.layer3Endpoints[serviceName];
  return checkServiceHealth(serviceName, baseUrl);
}

/**
 * Check health of all Layer 3 services
 *
 * Performs parallel health checks to all Layer 3 services.
 * Returns aggregated response with overall status.
 * Overall status is 'degraded' if any service is not 'healthy'.
 * Always returns HTTP 200 compatible response.
 *
 * @returns Aggregated health response for all services
 */
export async function checkAllLayer3Services(): Promise<AggregatedHealthResponse> {
  const timestamp = new Date().toISOString();
  const serviceNames = Object.keys(config.layer3Endpoints) as Layer3ServiceName[];

  // Perform all health checks in parallel
  const healthChecks = serviceNames.map((name) =>
    checkLayer3Service(name)
  );

  const services = await Promise.all(healthChecks);

  // Determine overall status - degraded if any service is not healthy
  const overallStatus: HealthStatus = services.every(
    (s) => s.status === 'healthy'
  )
    ? 'healthy'
    : 'degraded';

  return {
    status: overallStatus,
    timestamp,
    services,
  };
}

/**
 * Get the list of available Layer 3 service names
 *
 * @returns Array of Layer 3 service names
 */
export function getLayer3ServiceNames(): Layer3ServiceName[] {
  return Object.keys(config.layer3Endpoints) as Layer3ServiceName[];
}

/**
 * Validate a service name is a valid Layer 3 service
 *
 * @param name - Service name to validate
 * @returns True if valid Layer 3 service name
 */
export function isValidLayer3Service(name: string): name is Layer3ServiceName {
  return name in config.layer3Endpoints;
}
