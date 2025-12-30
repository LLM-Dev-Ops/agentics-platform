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
import { db } from '../db.js';
import { verifySupabaseJWT } from '../middleware/auth.js';

/**
 * Get or create organization for user
 */
async function getOrCreateOrg(userId: string): Promise<string> {
  // Check for existing org
  const existing = await db.query(
    `SELECT id FROM organizations WHERE owner_user_id = $1`,
    [userId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // Create new org
  const result = await db.query(
    `INSERT INTO organizations (owner_user_id, created_at)
     VALUES ($1, now())
     RETURNING id`,
    [userId]
  );

  return result.rows[0].id;
}

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

  // Verify Supabase JWT with HS256 signature validation
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
 * Register /v1/me route
 */
export async function registerMeRoute(fastify: FastifyInstance) {
  fastify.get('/v1/me', meHandler);
}
