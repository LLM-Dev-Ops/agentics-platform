/**
 * Intelligence Handler
 *
 * Routes all intelligence requests to LLM-Intelligence-Core.
 * Handles completions, embeddings, chat, model listing, and chains.
 *
 * CRITICAL: This handler implements NO business logic.
 * It only validates request structure and forwards to Layer 3.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { forwardRequest, forwardStreamingRequest, getIdentity, generateCorrelationId } from '../lib/router.js';

// Request schemas for validation
interface CompletionsRequest {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface EmbeddingsRequest {
  model: string;
  input: string | string[];
}

interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface ChainRequest {
  chain_type: string;
  steps: any[];
  context?: Record<string, any>;
}

/**
 * POST /v1/intelligence/completions
 * Generate text completions using LLM models
 */
export async function completionsHandler(
  request: FastifyRequest<{ Body: CompletionsRequest }>,
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

  const { model, prompt, stream } = request.body;

  if (!model || !prompt) {
    return reply.code(400).send({
      error: 'Missing required fields: model and prompt',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    // Handle streaming responses
    if (stream) {
      await forwardStreamingRequest(
        'intelligence',
        {
          method: 'POST',
          path: '/completions',
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
    const response = await forwardRequest('intelligence', {
      method: 'POST',
      path: '/completions',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach intelligence core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/intelligence/embeddings
 * Generate vector embeddings for text
 */
export async function embeddingsHandler(
  request: FastifyRequest<{ Body: EmbeddingsRequest }>,
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

  const { model, input } = request.body;

  if (!model || !input) {
    return reply.code(400).send({
      error: 'Missing required fields: model and input',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('intelligence', {
      method: 'POST',
      path: '/embeddings',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach intelligence core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/intelligence/chat
 * Multi-turn chat conversations
 */
export async function chatHandler(
  request: FastifyRequest<{ Body: ChatRequest }>,
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

  const { model, messages, stream } = request.body;

  if (!model || !messages || !Array.isArray(messages)) {
    return reply.code(400).send({
      error: 'Missing required fields: model and messages (array)',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    // Handle streaming responses
    if (stream) {
      await forwardStreamingRequest(
        'intelligence',
        {
          method: 'POST',
          path: '/chat',
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
    const response = await forwardRequest('intelligence', {
      method: 'POST',
      path: '/chat',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach intelligence core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * GET /v1/intelligence/models
 * List available models
 */
export async function modelsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = generateCorrelationId();
  const identity = getIdentity(request);

  try {
    const response = await forwardRequest('intelligence', {
      method: 'GET',
      path: '/models',
      query: request.query as Record<string, any>,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach intelligence core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}

/**
 * POST /v1/intelligence/chains
 * Execute chain-of-thought workflows
 */
export async function chainsHandler(
  request: FastifyRequest<{ Body: ChainRequest }>,
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

  const { chain_type, steps } = request.body;

  if (!chain_type || !steps || !Array.isArray(steps)) {
    return reply.code(400).send({
      error: 'Missing required fields: chain_type and steps (array)',
      code: 'INVALID_REQUEST',
      request_id: correlationId,
    });
  }

  try {
    const response = await forwardRequest('intelligence', {
      method: 'POST',
      path: '/chains',
      body: request.body,
      correlationId,
      userId: identity.userId,
      scopes: identity.scopes,
    });

    reply.code(response.statusCode).headers(response.headers).send(response.body);
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : 'Failed to reach intelligence core',
      code: 'UPSTREAM_ERROR',
      request_id: correlationId,
    });
  }
}
