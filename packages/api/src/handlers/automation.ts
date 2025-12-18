/**
 * Automation Handler
 *
 * Routes all automation requests to LLM-Automation-Core.
 * Handles workflows, jobs, schedules, and triggers.
 *
 * CRITICAL: This handler implements NO business logic.
 * It only validates request structure and forwards to Layer 3.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { forwardRequest, getIdentity, generateCorrelationId } from '../lib/router.js';

// Request schemas for validation
interface CreateWorkflowRequest {
  name: string;
  definition: Record<string, any>;
  triggers?: any[];
}

interface TriggerWorkflowRequest {
  input?: Record<string, any>;
}

interface CreateScheduleRequest {
  workflow_id: string;
  cron_expression: string;
  enabled?: boolean;
}

/**
 * POST /v1/automation/workflows
 * Create a new workflow
 */
export async function createWorkflowHandler(
  request: FastifyRequest<{ Body: CreateWorkflowRequest }>,
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

  const { name, definition } = request.body;

  if (!name || !definition) {
    return reply.code(400).send({
      error: 'Missing required fields: name and definition',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('automation', {
      method: 'POST',
      path: '/workflows',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach automation core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/automation/workflows/:id
 * Get workflow details
 */
export async function getWorkflowHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);
  const { id } = request.params;

  if (!id) {
    return reply.code(400).send({
      error: 'Missing workflow ID',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('automation', {
      method: 'GET',
      path: `/workflows/${id}`,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach automation core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/automation/workflows/:id/trigger
 * Trigger workflow execution
 */
export async function triggerWorkflowHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: TriggerWorkflowRequest }>,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);
  const { id } = request.params;

  if (!id) {
    return reply.code(400).send({
      error: 'Missing workflow ID',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('automation', {
      method: 'POST',
      path: `/workflows/${id}/trigger`,
      body: request.body || {},
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach automation core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/automation/jobs
 * List automation jobs
 */
export async function getJobsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('automation', {
      method: 'GET',
      path: '/jobs',
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach automation core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/automation/schedules
 * Create a new schedule
 */
export async function createScheduleHandler(
  request: FastifyRequest<{ Body: CreateScheduleRequest }>,
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

  const { workflow_id, cron_expression } = request.body;

  if (!workflow_id || !cron_expression) {
    return reply.code(400).send({
      error: 'Missing required fields: workflow_id and cron_expression',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('automation', {
      method: 'POST',
      path: '/schedules',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach automation core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}
