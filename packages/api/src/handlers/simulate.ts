/**
 * Simulate Handler
 *
 * Routes simulation requests to the Layer 3.5 execution spine after compilation (ADR-013).
 * Handles all input types: specification, cli_flags, and prompt.
 *
 * CRITICAL: This handler implements NO simulation execution logic.
 * Execution is delegated to agentics-orchestration-engine; reads resolve against
 * agentics-results-index and cancellation against agentics-simulation-runner.
 * Natural language prompts require an extra hop to Intelligence Core.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { forwardRequest, getIdentity, generateCorrelationId } from '../lib/router.js';
import {
  SimulationService,
  SimulationServiceError,
  type SimulationInput
} from '../services/simulation/index.js';
import {
  toOrchestrationSimulateRequest,
  fromOrchestrationSimulateResponse,
  fromResultsIndexRun,
  fromResultsIndexRunList,
  fromRunnerAbortResponse,
} from '../services/simulation/orchestration-adapter.js';
import config from '../config.js';

// Initialize SimulationService with Intelligence Core config
const simulationService = new SimulationService({
  intelligenceCore: {
    baseUrl: config.layer3Endpoints.intelligence,
    timeout: 30000
  }
});

function upstreamFailure(reply: FastifyReply, error: unknown, correlationId: string): void {
  reply.code(502).send({
    error: error instanceof Error ? error.message : 'Failed to reach the execution spine',
    code: 'UPSTREAM_ERROR',
    request_id: correlationId,
  });
}

/**
 * POST /v1/simulate
 *
 * Compiles a simulation and delegates execution to agentics-orchestration-engine.
 * 1. Extract input type (specification, cli_flags, or prompt)
 * 2. Call SimulationService.compileSimulation(input)
 * 3. If prompt: SimulationService forwards to Intelligence Core for interpretation
 * 4. Map the compiled spec onto the orchestration engine's SimulateRequest
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

    // Step 4: Delegate execution to the orchestration engine
    const response = await forwardRequest('orchestration', {
      method: 'POST',
      path: '/v1/simulate',
      body: toOrchestrationSimulateRequest(specification),
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    // Step 5: Adapt the spine response onto Layer 4's public contract
    reply
      .code(response.statusCode)
      .headers(response.headers)
      .send(fromOrchestrationSimulateResponse(response.body));
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

    upstreamFailure(reply, error, correlationId);
  }
}

/**
 * GET /v1/simulate/:id
 *
 * Gets simulation status and results from agentics-results-index.
 * Returns simulation_id, status, progress, results.
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
    const response = await forwardRequest('resultsIndex', {
      method: 'GET',
      path: `/api/v1/runs/${encodeURIComponent(request.params.id)}`,
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    if (response.statusCode >= 400) {
      return reply.code(response.statusCode).headers(response.headers).send(response.body);
    }

    reply
      .code(response.statusCode)
      .headers(response.headers)
      .send(fromResultsIndexRun(response.body));
  } catch (error) {
    upstreamFailure(reply, error, correlationId);
  }
}

/**
 * GET /v1/simulate
 *
 * Lists simulations for the authenticated user from agentics-results-index.
 */
export async function listSimulationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('resultsIndex', {
      method: 'GET',
      path: '/api/v1/runs',
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    if (response.statusCode >= 400) {
      return reply.code(response.statusCode).headers(response.headers).send(response.body);
    }

    reply
      .code(response.statusCode)
      .headers(response.headers)
      .send(fromResultsIndexRunList(response.body));
  } catch (error) {
    upstreamFailure(reply, error, correlationId);
  }
}

/**
 * DELETE /v1/simulate/:id
 *
 * Cancels a simulation via agentics-simulation-runner.
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
    const response = await forwardRequest('simulationRunner', {
      method: 'POST',
      path: `/v1/runner/abort/${encodeURIComponent(request.params.id)}`,
      body: { reason: 'Cancelled via Layer 4 DELETE /v1/simulate/:id' },
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply
      .code(response.statusCode)
      .headers(response.headers)
      .send(fromRunnerAbortResponse(request.params.id, response.body));
  } catch (error) {
    upstreamFailure(reply, error, correlationId);
  }
}
