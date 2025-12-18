/**
 * Identity Routes
 *
 * Registers all identity-related routes with Fastify.
 * Applies auth middleware and scope requirements per SPARC specification.
 */

import type { FastifyInstance } from 'fastify';
import {
  authenticateHandler,
  registerHandler,
  refreshTokenHandler,
  createApiKeyHandler,
  listApiKeysHandler,
  revokeApiKeyHandler,
  whoamiHandler,
  initiateOAuthHandler,
  oauthCallbackHandler,
} from '../handlers/identity.js';
import { authMiddleware } from '../middleware/auth.js';

/**
 * Register identity routes
 */
export async function registerIdentityRoutes(fastify: FastifyInstance) {
  // Public routes (no authentication required)

  /**
   * POST /v1/identity/authenticate
   * Authenticate with email/password or API key
   */
  fastify.post('/v1/identity/authenticate', authenticateHandler);

  /**
   * POST /v1/identity/register
   * Register a new user account
   */
  fastify.post('/v1/identity/register', registerHandler);

  /**
   * POST /v1/identity/refresh
   * Refresh an access token
   */
  fastify.post('/v1/identity/refresh', refreshTokenHandler);

  /**
   * GET /v1/identity/oauth/:provider
   * Initiate OAuth flow
   */
  fastify.get('/v1/identity/oauth/:provider', initiateOAuthHandler);

  /**
   * GET /v1/identity/oauth/:provider/callback
   * Handle OAuth callback
   */
  fastify.get('/v1/identity/oauth/:provider/callback', oauthCallbackHandler);

  // Protected routes (authentication required)

  /**
   * GET /v1/identity/whoami
   * Get current user information
   */
  fastify.get('/v1/identity/whoami', {
    onRequest: [authMiddleware],
    handler: whoamiHandler,
  });

  /**
   * POST /v1/identity/api-keys
   * Create a new API key
   */
  fastify.post('/v1/identity/api-keys', {
    onRequest: [authMiddleware],
    handler: createApiKeyHandler,
  });

  /**
   * GET /v1/identity/api-keys
   * List all API keys for current user
   */
  fastify.get('/v1/identity/api-keys', {
    onRequest: [authMiddleware],
    handler: listApiKeysHandler,
  });

  /**
   * DELETE /v1/identity/api-keys/:id
   * Revoke an API key
   */
  fastify.delete('/v1/identity/api-keys/:id', {
    onRequest: [authMiddleware],
    handler: revokeApiKeyHandler,
  });
}
