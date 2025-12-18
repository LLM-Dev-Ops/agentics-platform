/**
 * Simulate Handler
 *
 * Routes simulation requests to LLM-Research-Core after compilation.
 * Handles all input types: specification, cli_flags, and prompt.
 *
 * CRITICAL: This handler implements NO simulation execution logic.
 * It only compiles inputs and forwards to Layer 3 Research Core.
 * Natural language prompts require an extra hop to Intelligence Core.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { forwardRequest, getIdentity, generateCorrelationId } from '../lib/router.js';
import {
  SimulationService,
  SimulationServiceError,
  type SimulationInput
} from '../services/simulation/index.js';
import config from '../config.js';

// Initialize SimulationService with Intelligence Core config
const simulationService = new SimulationService({
  intelligenceCore: {
    baseUrl: config.layer3Endpoints.intelligence,
    timeout: 30000
  }
});

/**
 * POST /v1/simulate
 *
 * Compiles and executes a simulation.
 * Per SPARC:
 * 1. Extract input type (specification, cli_flags, or prompt)
 * 2. Call SimulationService.compileSimulation(input)
 * 3. If prompt: SimulationService forwards to Intelligence Core for interpretation
 * 4. Forward compiled spec to Research Core
 * 5. Return simulation_id, status, results
 */
export async function createSimulationHandler(
  request: FastifyRequest<{ Body: SimulationInput }>,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  // Validate request body
  if (!request.body || typeof request.body !== 'object') {
    return reply.code(400).send({
      error: 'Invalid request body',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    // Step 1 & 2: Compile simulation from input
    // This handles specification, cli_flags, or prompt
    // Prompts automatically forwarded to Intelligence Core by SimulationService
    const specification = await simulationService.compileSimulation(
      request.body,
      correlationId
    );

    // Step 4: Forward compiled specification to Research Core for execution
    const response = await forwardRequest('research', {
      method: 'POST',
      path: '/simulations',
      body: { specification },
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    // Step 5: Return response from Research Core
    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    // Handle simulation service errors
    if (error instanceof SimulationServiceError) {
      return reply.code(400).send({
        error: error.message,
        code: error.code,
        request_id: correlationId,
        details: error.details,
      });
    }

    // Handle upstream errors
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach research core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/simulate/:id
 *
 * Gets simulation status and results.
 * Per SPARC:
 * 1. Forward to Research Core to get status
 * 2. Return simulation_id, status, progress, results
 */
export async function getSimulationHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  // Validate simulation ID
  if (!request.params.id) {
    return reply.code(400).send({
      error: 'Simulation ID is required',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    // Forward to Research Core to get simulation status
    const response = await forwardRequest('research', {
      method: 'GET',
      path: `/simulations/${request.params.id}`,
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach research core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/simulate
 *
 * Lists simulations for the authenticated user.
 * Forwards to Research Core for listing.
 */
export async function listSimulationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('research', {
      method: 'GET',
      path: '/simulations',
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach research core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * DELETE /v1/simulate/:id
 *
 * Cancels or deletes a simulation.
 * Forwards to Research Core for cancellation.
 */
export async function deleteSimulationHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  // Validate simulation ID
  if (!request.params.id) {
    return reply.code(400).send({
      error: 'Simulation ID is required',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('research', {
      method: 'DELETE',
      path: `/simulations/${request.params.id}`,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach research core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}
