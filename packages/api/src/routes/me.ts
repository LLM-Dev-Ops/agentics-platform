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
import { db } from '../db.js';

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

  // Fetch organization details including Stripe metering status
  let stripeMeteringEnabled = false;
  try {
    const result = await db.query(
      'SELECT stripe_metering_enabled FROM organizations WHERE id = $1',
      [orgId]
    );
    if (result.rows.length > 0) {
      stripeMeteringEnabled = result.rows[0].stripe_metering_enabled ?? false;
    }
  } catch (error) {
    // Log but don't fail - default to false
    console.error('Failed to fetch org metering status:', error);
  }

  return reply.code(200).send({
    user_id: user.sub,
    org_id: orgId,
    email: user.email,
    stripe_metering_enabled: stripeMeteringEnabled,
  });
}

/**
 * Register /me route
 */
export async function registerMeRoute(fastify: FastifyInstance) {
  fastify.get('/me', meHandler);
}
