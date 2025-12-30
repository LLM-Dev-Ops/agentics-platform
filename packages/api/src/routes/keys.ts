/**
 * API Key Management Routes
 *
 * Self-service API key management endpoints.
 * Keys behave like Claude/OpenAI:
 * - Plaintext key shown once at creation
 * - Only hashes stored
 * - Revocable
 * - Org-scoped
 * - Admin-only (via API key) OR org owner (via Supabase JWT for dashboard)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { db } from '../db.js';
import { authMiddleware, hashApiKey, AuthContext, verifySupabaseJWT } from '../middleware/auth.js';
import { hasScope } from '../middleware/scope.js';

// Extend FastifyRequest to include dashboard auth
declare module 'fastify' {
  interface FastifyRequest {
    dashboardAuth?: {
      user_id: string;
      org_id: string;
    };
  }
}

/**
 * Dashboard auth middleware
 * Accepts EITHER API key (with admin scope) OR Supabase JWT (org owner)
 */
async function dashboardAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  console.log('✅ DASHBOARD AUTH MIDDLEWARE FIRED:', request.url);
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      request_id: request.id,
    });
    return;
  }

  const token = authHeader.substring(7);

  // Check if it's an API key (starts with agentics_)
  if (token.startsWith('agentics_')) {
    // Use standard API key auth
    await authMiddleware(request, reply);
    return;
  }

  // Otherwise, treat as Supabase JWT with HS256 signature validation
  const user = await verifySupabaseJWT(token);

  if (!user) {
    reply.code(401).send({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
      request_id: request.id,
    });
    return;
  }

  // Get org for user
  const orgResult = await db.query(
    `SELECT id FROM organizations WHERE owner_user_id = $1`,
    [user.sub]
  );

  if (orgResult.rows.length === 0) {
    reply.code(403).send({
      error: 'No organization found. Please complete setup first.',
      code: 'NO_ORGANIZATION',
      request_id: request.id,
    });
    return;
  }

  // Set dashboard auth context
  request.dashboardAuth = {
    user_id: user.sub,
    org_id: orgResult.rows[0].id,
  };

  // Also set auth context for compatibility with existing handlers
  request.auth = {
    org_id: orgResult.rows[0].id,
    key_id: 'dashboard',
    scopes: ['admin'], // Dashboard users have admin access to their own org
  };
}

/**
 * Check if request is authorized (API key with admin OR dashboard owner)
 */
function requireAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  // Dashboard auth (Supabase JWT) - org owners have implicit admin
  if (request.dashboardAuth) {
    return true;
  }

  // API key auth - require admin scope
  if (request.auth) {
    if (!hasScope(request.auth, 'admin')) {
      reply.code(403).send({
        error: 'Admin scope required',
        code: 'FORBIDDEN',
        request_id: request.id,
      });
      return false;
    }
    return true;
  }

  reply.code(401).send({
    error: 'Authentication required',
    code: 'AUTHENTICATION_REQUIRED',
    request_id: request.id,
  });
  return false;
}

/**
 * Generate a new API key
 * Format: agentics_sk_live_<random_hex_32>
 */
function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `agentics_sk_live_${randomBytes}`;
}

/**
 * POST /v1/keys
 * Create a new API key for the organization
 */
async function createKeyHandler(
  request: FastifyRequest<{
    Body: {
      name?: string;
      scopes?: string[];
    };
  }>,
  reply: FastifyReply
) {
  if (!requireAuth(request, reply)) {
    return;
  }

  const orgId = request.auth!.org_id;
  const { name, scopes = ['platform:read'] } = request.body || {};

  // Generate plaintext key
  const plaintextKey = generateApiKey();

  // Hash for storage (never store plaintext)
  const keyHash = hashApiKey(plaintextKey);

  // Insert into database
  const result = await db.query(
    `
    INSERT INTO api_keys (key_hash, org_id, name, scopes, is_active, created_at)
    VALUES ($1, $2, $3, $4, true, now())
    RETURNING id, name, scopes, created_at
    `,
    [keyHash, orgId, name || 'Unnamed Key', scopes]
  );

  const record = result.rows[0];

  // Return plaintext key ONCE (never logged, never stored)
  return reply.code(201).send({
    api_key: plaintextKey,
    id: record.id,
    name: record.name,
    scopes: record.scopes,
    created_at: record.created_at,
  });
}

/**
 * GET /v1/keys
 * List all API keys for the organization
 */
async function listKeysHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!requireAuth(request, reply)) {
    return;
  }

  const orgId = request.auth!.org_id;

  const result = await db.query(
    `
    SELECT id, name, scopes, is_active, created_at, last_used_at, revoked_at
    FROM api_keys
    WHERE org_id = $1
    ORDER BY created_at DESC
    `,
    [orgId]
  );

  return reply.code(200).send({
    keys: result.rows.map(row => ({
      id: row.id,
      name: row.name,
      scopes: row.scopes,
      is_active: row.is_active,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
      revoked_at: row.revoked_at,
    })),
  });
}

/**
 * DELETE /v1/keys/:id
 * Revoke an API key
 */
async function revokeKeyHandler(
  request: FastifyRequest<{
    Params: {
      id: string;
    };
  }>,
  reply: FastifyReply
) {
  if (!requireAuth(request, reply)) {
    return;
  }

  const orgId = request.auth!.org_id;
  const { id } = request.params;

  const result = await db.query(
    `
    UPDATE api_keys
    SET is_active = false, revoked_at = now()
    WHERE id = $1 AND org_id = $2
    RETURNING id
    `,
    [id, orgId]
  );

  if (result.rowCount === 0) {
    return reply.code(404).send({
      error: 'API key not found',
      code: 'NOT_FOUND',
      request_id: request.id,
    });
  }

  return reply.code(200).send({
    success: true,
    message: 'API key revoked',
  });
}

/**
 * Register API key management routes
 */
export async function registerKeyRoutes(fastify: FastifyInstance) {
  console.log('🧩 REGISTERING /keys ROUTES');
  // POST /keys - Create API key
  fastify.post('/keys', {
    onRequest: [dashboardAuthMiddleware],
    handler: createKeyHandler,
  });

  // GET /keys - List API keys
  fastify.get('/keys', {
    onRequest: [dashboardAuthMiddleware],
    handler: listKeysHandler,
  });

  // DELETE /keys/:id - Revoke API key
  fastify.delete('/keys/:id', {
    onRequest: [dashboardAuthMiddleware],
    handler: revokeKeyHandler,
  });
}
