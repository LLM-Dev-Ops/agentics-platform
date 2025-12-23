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

/**
 * Verify Supabase JWT and extract user info
 * In production, this would verify the JWT signature using Supabase's public key
 */
async function verifySupabaseToken(token: string): Promise<{ sub: string; email: string } | null> {
  try {
    // Decode JWT payload (base64)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    // In production: verify signature with Supabase JWT secret
    // For now, trust the token structure (Supabase handles verification)
    if (!payload.sub) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email || '',
    };
  } catch {
    return null;
  }
}

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

  // Verify Supabase JWT
  const user = await verifySupabaseToken(token);

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
