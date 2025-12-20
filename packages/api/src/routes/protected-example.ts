/**
 * Example Protected Routes
 *
 * Demonstrates API key authentication with scope enforcement.
 * All routes require a valid API key via: Authorization: Bearer <api_key>
 *
 * Example usage:
 *   curl -H "Authorization: Bearer agentics_abc123..." http://localhost:3000/v1/example/protected
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, AuthContext } from '../middleware/auth.js';
import { hasScope } from '../middleware/scope.js';

/**
 * Register example protected routes
 */
export async function registerProtectedExampleRoutes(fastify: FastifyInstance) {
  /**
   * GET /v1/example/protected
   *
   * A simple protected endpoint that returns the auth context.
   * Requires: Valid API key (any scope)
   *
   * Example:
   *   curl -H "Authorization: Bearer agentics_..." http://localhost:3000/v1/example/protected
   *
   * Success Response (200):
   *   {
   *     "success": true,
   *     "data": {
   *       "message": "You are authenticated!",
   *       "auth": {
   *         "org_id": "org_123",
   *         "key_id": "key_456",
   *         "scopes": ["intelligence:read", "intelligence:write"]
   *       }
   *     }
   *   }
   *
   * Error Response (401):
   *   {
   *     "error": "Authentication required",
   *     "code": "AUTHENTICATION_REQUIRED",
   *     "message": "Valid API key required. Use Authorization: Bearer <api_key>"
   *   }
   */
  fastify.get('/v1/example/protected', {
    onRequest: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = request.auth!;

      return reply.code(200).send({
        success: true,
        data: {
          message: 'You are authenticated!',
          auth: {
            org_id: auth.org_id,
            key_id: auth.key_id,
            scopes: auth.scopes,
          },
        },
      });
    },
  });

  /**
   * GET /v1/example/protected/scoped
   *
   * A protected endpoint that requires a specific scope.
   * Requires: Valid API key with 'example:read' scope
   *
   * Example:
   *   curl -H "Authorization: Bearer agentics_..." http://localhost:3000/v1/example/protected/scoped
   *
   * Success Response (200):
   *   {
   *     "success": true,
   *     "data": {
   *       "message": "You have the required scope!",
   *       "requiredScope": "example:read"
   *     }
   *   }
   *
   * Error Response (403):
   *   {
   *     "error": "Insufficient permissions",
   *     "code": "AUTHORIZATION_DENIED",
   *     "details": {
   *       "requiredScope": "example:read",
   *       "keyScopes": ["other:read"]
   *     }
   *   }
   */
  fastify.get('/v1/example/protected/scoped', {
    onRequest: [authMiddleware],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = request.auth!;
      const requiredScope = 'example:read';

      // Manual scope check for custom scope requirements
      if (!hasScope(auth, requiredScope)) {
        return reply.code(403).send({
          error: 'Insufficient permissions',
          code: 'AUTHORIZATION_DENIED',
          request_id: request.id,
          details: {
            requiredScope,
            keyScopes: auth.scopes,
          },
        });
      }

      return reply.code(200).send({
        success: true,
        data: {
          message: 'You have the required scope!',
          requiredScope,
        },
      });
    },
  });

  /**
   * POST /v1/example/protected/action
   *
   * A protected endpoint that performs an action.
   * Requires: Valid API key with 'example:write' scope
   *
   * Example:
   *   curl -X POST \
   *     -H "Authorization: Bearer agentics_..." \
   *     -H "Content-Type: application/json" \
   *     -d '{"action": "test"}' \
   *     http://localhost:3000/v1/example/protected/action
   */
  fastify.post('/v1/example/protected/action', {
    onRequest: [authMiddleware],
    handler: async (
      request: FastifyRequest<{ Body: { action: string } }>,
      reply: FastifyReply
    ) => {
      const auth = request.auth!;
      const requiredScope = 'example:write';

      // Check for write scope
      if (!hasScope(auth, requiredScope)) {
        return reply.code(403).send({
          error: 'Insufficient permissions',
          code: 'AUTHORIZATION_DENIED',
          request_id: request.id,
          details: {
            requiredScope,
            keyScopes: auth.scopes,
          },
        });
      }

      const { action } = request.body || { action: 'unknown' };

      return reply.code(200).send({
        success: true,
        data: {
          message: `Action '${action}' performed successfully`,
          performedBy: {
            org_id: auth.org_id,
            key_id: auth.key_id,
          },
          timestamp: new Date().toISOString(),
        },
      });
    },
  });
}
