/**
 * Identity Handlers
 *
 * HTTP handlers for identity-related endpoints.
 * Follows SPARC API surface specification.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { IdentityService } from '../services/identity/index.js';

// Initialize identity service (singleton for MVP)
const identityService = new IdentityService();

/**
 * POST /v1/identity/authenticate
 *
 * Authenticate with email/password or API key
 */
export async function authenticateHandler(
  request: FastifyRequest<{
    Body: {
      email?: string;
      password?: string;
      apiKey?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { email, password, apiKey } = request.body;

    const result = await identityService.authenticate({
      email: email || '',
      password,
      apiKey,
    });

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return reply.code(401).send({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message,
      },
    });
  }
}

/**
 * POST /v1/identity/register
 *
 * Register a new user account
 */
export async function registerHandler(
  request: FastifyRequest<{
    Body: {
      email: string;
      password: string;
      name?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { email, password, name } = request.body;

    if (!email || !password) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Email and password are required',
        },
      });
    }

    const user = await identityService.createUser({ email, password, name });

    // Automatically authenticate after registration
    const result = await identityService.authenticate({ email, password });

    return reply.code(201).send({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    const code = message.includes('already exists') ? 409 : 400;

    return reply.code(code).send({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message,
      },
    });
  }
}

/**
 * POST /v1/identity/refresh
 *
 * Refresh an access token
 */
export async function refreshTokenHandler(
  request: FastifyRequest<{
    Body: {
      refreshToken: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Refresh token is required',
        },
      });
    }

    const result = await identityService.refreshToken(refreshToken);

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    return reply.code(401).send({
      success: false,
      error: {
        code: 'TOKEN_REFRESH_FAILED',
        message,
      },
    });
  }
}

/**
 * POST /v1/identity/api-keys
 *
 * Create a new API key
 */
export async function createApiKeyHandler(
  request: FastifyRequest<{
    Body: {
      name: string;
      scopes?: string[];
      expiresAt?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    // Get user from auth context (set by auth middleware)
    const userId = request.identity?.userId;
    if (!userId) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { name, scopes = ['api:read'], expiresAt } = request.body;

    if (!name) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Name is required',
        },
      });
    }

    const apiKeyService = identityService.getApiKeyService();
    const result = await apiKeyService.createApiKey({
      userId,
      name,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return reply.code(201).send({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create API key';
    return reply.code(400).send({
      success: false,
      error: {
        code: 'API_KEY_CREATION_FAILED',
        message,
      },
    });
  }
}

/**
 * GET /v1/identity/api-keys
 *
 * List all API keys for the current user
 */
export async function listApiKeysHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Get user from auth context
    const userId = request.identity?.userId;
    if (!userId) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const apiKeyService = identityService.getApiKeyService();
    const apiKeys = await apiKeyService.listApiKeys(userId);

    return reply.code(200).send({
      success: true,
      data: {
        apiKeys,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list API keys';
    return reply.code(500).send({
      success: false,
      error: {
        code: 'API_KEY_LIST_FAILED',
        message,
      },
    });
  }
}

/**
 * DELETE /v1/identity/api-keys/:id
 *
 * Revoke an API key
 */
export async function revokeApiKeyHandler(
  request: FastifyRequest<{
    Params: {
      id: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    // Get user from auth context
    const userId = request.identity?.userId;
    if (!userId) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { id } = request.params;

    const apiKeyService = identityService.getApiKeyService();
    await apiKeyService.revokeApiKey(userId, id);

    return reply.code(200).send({
      success: true,
      data: {
        message: 'API key revoked successfully',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke API key';
    const code = message.includes('not found') ? 404 : 400;

    return reply.code(code).send({
      success: false,
      error: {
        code: 'API_KEY_REVOCATION_FAILED',
        message,
      },
    });
  }
}

/**
 * GET /v1/identity/whoami
 *
 * Get current user information
 */
export async function whoamiHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header required',
        },
      });
    }

    const result = await identityService.whoami(authHeader);

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get user info';
    return reply.code(401).send({
      success: false,
      error: {
        code: 'WHOAMI_FAILED',
        message,
      },
    });
  }
}

/**
 * GET /v1/identity/oauth/:provider
 *
 * Initiate OAuth flow
 */
export async function initiateOAuthHandler(
  request: FastifyRequest<{
    Params: {
      provider: 'google' | 'github';
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { provider } = request.params;

    const oauthService = identityService.getOAuthService();
    const result = oauthService.initiateOAuth(provider);

    return reply.code(200).send({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initiate OAuth';
    return reply.code(400).send({
      success: false,
      error: {
        code: 'OAUTH_INITIATION_FAILED',
        message,
      },
    });
  }
}

/**
 * GET /v1/identity/oauth/:provider/callback
 *
 * Handle OAuth callback
 */
export async function oauthCallbackHandler(
  request: FastifyRequest<{
    Params: {
      provider: 'google' | 'github';
    };
    Querystring: {
      code: string;
      state: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { provider } = request.params;
    const { code, state } = request.query;

    if (!code || !state) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Code and state are required',
        },
      });
    }

    const oauthService = identityService.getOAuthService();
    const callbackResult = await oauthService.handleCallback(provider, code, state);

    // Issue tokens for the user
    const tokenService = identityService.getTokenService();
    const scopes = ['api:read', 'api:write'];
    const tokenPair = tokenService.issueTokenPair(
      callbackResult.user.id,
      callbackResult.user.email,
      scopes
    );

    return reply.code(200).send({
      success: true,
      data: {
        user: {
          id: callbackResult.user.id,
          email: callbackResult.user.email,
          name: callbackResult.user.name,
        },
        isNewUser: callbackResult.isNewUser,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth callback failed';
    return reply.code(400).send({
      success: false,
      error: {
        code: 'OAUTH_CALLBACK_FAILED',
        message,
      },
    });
  }
}

// Export the identity service instance for use in middleware
export { identityService };
