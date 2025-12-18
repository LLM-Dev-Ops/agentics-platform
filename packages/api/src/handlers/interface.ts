/**
 * Interface Handler
 *
 * Routes all interface requests to LLM-Interface-Core.
 * Handles conversations, messages, sessions, and formatting.
 *
 * CRITICAL: This handler implements NO business logic.
 * It only validates request structure and forwards to Layer 3.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { forwardRequest, forwardStreamingRequest, getIdentity, generateCorrelationId } from '../lib/router.js';

// Request schemas for validation
interface CreateConversationRequest {
  title?: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface CreateMessageRequest {
  content: string;
  role?: string;
  metadata?: Record<string, any>;
  stream?: boolean;
}

interface FormatRequest {
  content: any;
  format: string;
  options?: Record<string, any>;
}

/**
 * POST /v1/interface/conversations
 * Create a new conversation
 */
export async function createConversationHandler(
  request: FastifyRequest<{ Body: CreateConversationRequest }>,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  // Validate request body (optional fields, so just check it's an object)
  if (request.body && typeof request.body !== 'object') {
    return reply.code(400).send({
      error: 'Invalid request body',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('interface', {
      method: 'POST',
      path: '/conversations',
      body: request.body || {},
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach interface core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/interface/conversations/:id
 * Get conversation details
 */
export async function getConversationHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);
  const { id } = request.params;

  if (!id) {
    return reply.code(400).send({
      error: 'Missing conversation ID',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('interface', {
      method: 'GET',
      path: `/conversations/${id}`,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach interface core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/interface/conversations/:id/messages
 * Add a message to a conversation
 */
export async function createMessageHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: CreateMessageRequest }>,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);
  const { id } = request.params;

  if (!id) {
    return reply.code(400).send({
      error: 'Missing conversation ID',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  // Validate request body
  if (!request.body || typeof request.body !== 'object') {
    return reply.code(400).send({
      error: 'Invalid request body',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  const { content, stream } = request.body;

  if (!content) {
    return reply.code(400).send({
      error: 'Missing required field: content',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    // Handle streaming responses
    if (stream) {
      await forwardStreamingRequest(
        'interface',
        {
          method: 'POST',
          path: `/conversations/${id}/messages`,
          body: request.body,
          correlationId,
          userId: identity.userId,
          scopes: identity.scopes,
        },
        reply
      );
      return;
    }

    // Handle non-streaming responses
    const response = await forwardRequest('interface', {
      method: 'POST',
      path: `/conversations/${id}/messages`,
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach interface core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/interface/sessions
 * List user sessions
 */
export async function getSessionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('interface', {
      method: 'GET',
      path: '/sessions',
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach interface core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/interface/format
 * Format content for different output types
 */
export async function formatHandler(
  request: FastifyRequest<{ Body: FormatRequest }>,
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

  const { content, format } = request.body;

  if (content === undefined || !format) {
    return reply.code(400).send({
      error: 'Missing required fields: content and format',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('interface', {
      method: 'POST',
      path: '/format',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach interface core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}
