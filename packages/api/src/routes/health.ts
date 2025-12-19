/**
 * Layer 3 Health Routes
 *
 * Thin routing layer for Layer 3 health check endpoints.
 * All business logic is delegated to the health service module.
 *
 * Routes:
 * - GET /health/intelligence - Intelligence Core health
 * - GET /health/security - Security Core health
 * - GET /health/automation - Automation Core health
 * - GET /health/governance - Governance Core health
 * - GET /health/data - Data Core health
 * - GET /health/research - Research Core health
 * - GET /health/ecosystem - Ecosystem Core health
 * - GET /health/interface - Interface Core health
 * - GET /health/layer3 - Aggregated health for all Layer 3 services
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  checkLayer3Service,
  checkAllLayer3Services,
  Layer3ServiceName,
} from '../services/health/layer3.js';

/**
 * Individual Layer 3 service health handler factory
 *
 * Creates a handler that checks the health of a specific Layer 3 service.
 * Always returns HTTP 200 with structured response.
 *
 * @param serviceName - The Layer 3 service to check
 * @returns Fastify route handler
 */
function createServiceHealthHandler(serviceName: Layer3ServiceName) {
  return async function handler(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const health = await checkLayer3Service(serviceName);
    reply.status(200).send(health);
  };
}

/**
 * Aggregated Layer 3 health handler
 *
 * Checks health of all Layer 3 services and returns aggregated response.
 * Always returns HTTP 200 with structured response.
 * Status is 'degraded' if any service is not healthy.
 */
async function layer3AggregatedHealthHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const health = await checkAllLayer3Services();
  reply.status(200).send(health);
}

/**
 * Register Layer 3 health routes on a Fastify instance
 *
 * Adds read-only health check routes for each Layer 3 service
 * and an aggregated route for all services.
 *
 * Note: This does NOT affect existing /health or /health/observability routes.
 *
 * @param app - Fastify instance to register routes on
 */
export function registerLayer3HealthRoutes(app: FastifyInstance): void {
  // Individual Layer 3 service health endpoints
  app.get('/health/intelligence', createServiceHealthHandler('intelligence'));
  app.get('/health/security', createServiceHealthHandler('security'));
  app.get('/health/automation', createServiceHealthHandler('automation'));
  app.get('/health/governance', createServiceHealthHandler('governance'));
  app.get('/health/data', createServiceHealthHandler('data'));
  app.get('/health/research', createServiceHealthHandler('research'));
  app.get('/health/ecosystem', createServiceHealthHandler('ecosystem'));
  app.get('/health/interface', createServiceHealthHandler('interface'));

  // Aggregated Layer 3 health endpoint
  app.get('/health/layer3', layer3AggregatedHealthHandler);
}
