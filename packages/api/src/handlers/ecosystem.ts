/**
 * Ecosystem Handler
 *
 * Routes all ecosystem requests to LLM-Ecosystem-Core.
 * Handles integrations, connections, marketplace, webhooks, and plugins.
 *
 * CRITICAL: This handler implements NO business logic.
 * It only validates request structure and forwards to Layer 3.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { forwardRequest, getIdentity, generateCorrelationId } from '../lib/router.js';

// Request schemas for validation
interface ConnectRequest {
  integration_id: string;
  credentials: Record<string, any>;
  config?: Record<string, any>;
}

interface WebhookRequest {
  url: string;
  events: string[];
  secret?: string;
}

/**
 * GET /v1/ecosystem/integrations
 * List available integrations
 */
export async function integrationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('ecosystem', {
      method: 'GET',
      path: '/integrations',
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach ecosystem core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/ecosystem/connect
 * Connect to an external integration
 */
export async function connectHandler(
  request: FastifyRequest<{ Body: ConnectRequest }>,
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

  const { integration_id, credentials } = request.body;

  if (!integration_id || !credentials) {
    return reply.code(400).send({
      error: 'Missing required fields: integration_id and credentials',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('ecosystem', {
      method: 'POST',
      path: '/connect',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach ecosystem core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/ecosystem/marketplace
 * Browse marketplace items
 */
export async function marketplaceHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('ecosystem', {
      method: 'GET',
      path: '/marketplace',
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach ecosystem core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/ecosystem/webhooks
 * Create a new webhook
 */
export async function webhooksHandler(
  request: FastifyRequest<{ Body: WebhookRequest }>,
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

  const { url, events } = request.body;

  if (!url || !events || !Array.isArray(events)) {
    return reply.code(400).send({
      error: 'Missing required fields: url and events (array)',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('ecosystem', {
      method: 'POST',
      path: '/webhooks',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach ecosystem core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/ecosystem/plugins
 * List available plugins
 */
export async function pluginsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('ecosystem', {
      method: 'GET',
      path: '/plugins',
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach ecosystem core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}
