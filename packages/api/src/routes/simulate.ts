/**
 * Simulate Routes
 *
 * Registers all simulation-related routes with Fastify.
 * Applies auth middleware and scope requirements per SPARC specification.
 *
 * Per SPARC:
 * - POST /v1/simulate requires research:write scope
 * - GET /v1/simulate/:id requires research:read scope
 * - Layer 4 compiles inputs and forwards to agentics-orchestration-engine (ADR-013)
 * - Natural language prompts are sent to LLM-Intelligence-Core first
 */

import type { FastifyInstance } from 'fastify';
import {
  createSimulationHandler,
  getSimulationHandler,
  listSimulationsHandler,
  deleteSimulationHandler,
} from '../handlers/simulate.js';
import { authMiddleware } from '../middleware/auth.js';

/**
 * Register simulation routes
 *
 * All simulation routes require authentication.
 * Scope validation is handled by the scope middleware (already configured globally).
 */
export async function registerSimulateRoutes(fastify: FastifyInstance) {
  /**
   * POST /v1/simulate
   * Create and execute a simulation
   *
   * Accepts:
   * - { specification: SimulationSpecification } - Direct specification
   * - { cli_flags: { scenario, duration, users, ... } } - CLI flag format
   * - { prompt: string } - Natural language description
   *
   * Returns: { simulation_id, status, results }
   *
   * Scope required: research:write
   */
  fastify.post('/v1/simulate', {
    onRequest: [authMiddleware],
    handler: createSimulationHandler,
  });

  /**
   * GET /v1/simulate/:id
   * Get simulation status and results
   *
   * Returns: { simulation_id, status, progress, results }
   *
   * Scope required: research:read
   */
  fastify.get('/v1/simulate/:id', {
    onRequest: [authMiddleware],
    handler: getSimulationHandler,
  });

  /**
   * GET /v1/simulate
   * List simulations for the authenticated user
   *
   * Returns: { simulations: [...] }
   *
   * Scope required: research:read
   */
  fastify.get('/v1/simulate', {
    onRequest: [authMiddleware],
    handler: listSimulationsHandler,
  });

  /**
   * DELETE /v1/simulate/:id
   * Cancel or delete a simulation
   *
   * Returns: { simulation_id, status }
   *
   * Scope required: research:write
   */
  fastify.delete('/v1/simulate/:id', {
    onRequest: [authMiddleware],
    handler: deleteSimulationHandler,
  });
}
