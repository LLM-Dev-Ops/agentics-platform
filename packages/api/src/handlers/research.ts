/**
 * Research Handler
 *
 * Routes all research requests to LLM-Research-Core.
 * Handles simulations, experiments, results, and hypotheses.
 *
 * CRITICAL: This handler implements NO business logic.
 * It only validates request structure and forwards to Layer 3.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { forwardRequest, getIdentity, generateCorrelationId } from '../lib/router.js';

// Request schemas for validation
interface CreateSimulationRequest {
  specification?: Record<string, any>;
  prompt?: string;
  scenario?: string;
  parameters?: Record<string, any>;
}

interface CreateExperimentRequest {
  name: string;
  hypothesis: string;
  configuration: Record<string, any>;
}

interface CreateHypothesisRequest {
  description: string;
  variables: string[];
  expected_outcome?: string;
}

/**
 * POST /v1/research/simulations
 * Create and run a simulation
 */
export async function createSimulationHandler(
  request: FastifyRequest<{ Body: CreateSimulationRequest }>,
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

  // At least one of specification, prompt, or scenario must be provided
  const { specification, prompt, scenario } = request.body;

  if (!specification && !prompt && !scenario) {
    return reply.code(400).send({
      error: 'Must provide at least one of: specification, prompt, or scenario',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('research', {
      method: 'POST',
      path: '/simulations',
      body: request.body,
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
 * GET /v1/research/simulations/:id
 * Get simulation status and results
 */
export async function getSimulationHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);
  const { id } = request.params;

  if (!id) {
    return reply.code(400).send({
      error: 'Missing simulation ID',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('research', {
      method: 'GET',
      path: `/simulations/${id}`,
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
 * POST /v1/research/experiments
 * Create a new experiment
 */
export async function createExperimentHandler(
  request: FastifyRequest<{ Body: CreateExperimentRequest }>,
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

  const { name, hypothesis, configuration } = request.body;

  if (!name || !hypothesis || !configuration) {
    return reply.code(400).send({
      error: 'Missing required fields: name, hypothesis, and configuration',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('research', {
      method: 'POST',
      path: '/experiments',
      body: request.body,
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
 * GET /v1/research/results
 * Get research results
 */
export async function getResultsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('research', {
      method: 'GET',
      path: '/results',
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
 * POST /v1/research/hypotheses
 * Create a new hypothesis
 */
export async function createHypothesisHandler(
  request: FastifyRequest<{ Body: CreateHypothesisRequest }>,
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

  const { description, variables } = request.body;

  if (!description || !variables || !Array.isArray(variables)) {
    return reply.code(400).send({
      error: 'Missing required fields: description and variables (array)',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('research', {
      method: 'POST',
      path: '/hypotheses',
      body: request.body,
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
