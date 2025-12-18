/**
 * Governance Handler
 *
 * Routes all governance requests to LLM-Governance-Core.
 * Handles validation, policies, approvals, compliance, and assessments.
 *
 * CRITICAL: This handler implements NO business logic.
 * It only validates request structure and forwards to Layer 3.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { forwardRequest, getIdentity, generateCorrelationId } from '../lib/router.js';

// Request schemas for validation
interface ValidateRequest {
  resource: Record<string, any>;
  policy_ids?: string[];
}

interface ApprovalRequest {
  resource_type: string;
  resource_id: string;
  approvers: string[];
  context?: Record<string, any>;
}

interface AssessRequest {
  resource: Record<string, any>;
  framework?: string;
  scope?: string[];
}

/**
 * POST /v1/governance/validate
 * Validate resources against governance policies
 */
export async function validateHandler(
  request: FastifyRequest<{ Body: ValidateRequest }>,
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

  const { resource } = request.body;

  if (!resource) {
    return reply.code(400).send({
      error: 'Missing required field: resource',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('governance', {
      method: 'POST',
      path: '/validate',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach governance core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/governance/policies
 * List governance policies
 */
export async function policiesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('governance', {
      method: 'GET',
      path: '/policies',
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach governance core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/governance/approvals
 * Create approval workflow
 */
export async function approvalsHandler(
  request: FastifyRequest<{ Body: ApprovalRequest }>,
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

  const { resource_type, resource_id, approvers } = request.body;

  if (!resource_type || !resource_id || !approvers) {
    return reply.code(400).send({
      error: 'Missing required fields: resource_type, resource_id, and approvers',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('governance', {
      method: 'POST',
      path: '/approvals',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach governance core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/governance/compliance
 * Get compliance status and reports
 */
export async function complianceHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('governance', {
      method: 'GET',
      path: '/compliance',
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach governance core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/governance/assess
 * Assess resources for governance compliance
 */
export async function assessHandler(
  request: FastifyRequest<{ Body: AssessRequest }>,
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

  const { resource } = request.body;

  if (!resource) {
    return reply.code(400).send({
      error: 'Missing required field: resource',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('governance', {
      method: 'POST',
      path: '/assess',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach governance core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}
