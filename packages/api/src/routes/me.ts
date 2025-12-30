/**
 * User Info Route (GET /v1/me)
 *
 * Returns user and organization info for the authenticated Supabase user.
 * This endpoint is for the FRONTEND ONLY - uses Supabase JWT, NOT API keys.
 *
 * On first login, creates an organization for the user.
 * On subsequent logins, returns existing organization.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifySupabaseJWT, getOrCreateOrg } from '../middleware/auth.js';

/**
 * GET /v1/me
 * Returns user and organization info for the authenticated Supabase user
 */
async function meHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
      request_id: request.id,
    });
  }

  const token = authHeader.substring(7);

  // Verify Supabase JWT with ES256 signature validation via JWKS
  const user = await verifySupabaseJWT(token);

  if (!user) {
    return reply.code(401).send({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
      request_id: request.id,
    });
  }

  // Get or create organization
  const orgId = await getOrCreateOrg(user.sub);

  return reply.code(200).send({
    user_id: user.sub,
    org_id: orgId,
    email: user.email,
  });
}

/**
 * Register /me route
 */
export async function registerMeRoute(fastify: FastifyInstance) {
  fastify.get('/me', meHandler);
}
