/**
 * Authentication Middleware
 *
 * Supports TWO authentication methods:
 * 1. Supabase JWT (for UI/dashboard routes) - checked FIRST
 * 2. API keys (for machine/programmatic access) - checked SECOND
 *
 * Auth order is CRITICAL:
 * 1️⃣ Supabase JWT (UI routes: /v1/me, /v1/keys, /v1/keys/*)
 * 2️⃣ API key (machine routes)
 * 3️⃣ Reject
 *
 * Auth context attached to request: { org_id, key_id, scopes }
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';

// UI routes that accept Supabase JWT authentication
const UI_ROUTES = ['/v1/me', '/v1/keys'];

/**
 * Authentication context attached to authenticated requests
 */
export interface AuthContext {
  org_id: string;
  key_id: string;
  scopes: string[];
}

/**
 * Legacy Identity interface for backwards compatibility with entitlements
 * Maps org_id to userId for internal systems that still use userId
 */
export interface Identity {
  userId: string;
  email?: string;
  scopes: string[];
  entitlements: Entitlements;
}

export interface Entitlements {
  plan: 'free' | 'developer' | 'team' | 'enterprise';
  maxRequests: number;
  maxTokens: number;
  maxApiKeys: number;
}

export interface Credentials {
  type: 'api_key';
  value: string;
}

/**
 * API Key record stored in the database
 * Keys belong to an organization and have scopes
 */
export interface ApiKeyRecord {
  id: string;
  org_id: string;
  name: string;
  scopes: string[];
  key_hash: string;
  created_at: Date;
  expires_at?: Date;
  revoked: boolean;
  last_used_at?: Date;
}

// Augment Fastify request with auth context and identity
declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
    identity?: Identity;
  }
}

/**
 * Hash an API key using SHA-256 for fast lookups
 * Note: We use SHA-256 for the primary lookup, but store bcrypt hash for security
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Extract API key from Authorization header
 * Format: Authorization: Bearer <api_key>
 */
export function extractCredentials(request: FastifyRequest): Credentials | null {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix

  // API keys must start with 'agentics_' prefix
  if (token.startsWith('agentics_')) {
    return {
      type: 'api_key',
      value: token,
    };
  }

  return null;
}

/**
 * Validate result returned from validateApiKey
 */
export interface ValidateResult {
  auth: AuthContext;
  identity: Identity;
}

/**
 * Validate API key credentials and return auth context
 * Returns null if:
 * - Credentials are missing
 * - API key is invalid
 * - API key is revoked
 * - API key is expired
 */
export async function validateCredentials(credentials: Credentials | null): Promise<ValidateResult | null> {
  if (!credentials) {
    return null;
  }

  if (credentials.type === 'api_key') {
    const apiKey = await lookupApiKey(credentials.value);

    if (!apiKey) {
      return null;
    }

    if (apiKey.revoked) {
      return null;
    }

    if (apiKey.expires_at && apiKey.expires_at < new Date()) {
      return null;
    }

    // Build auth context as specified in requirements
    const auth: AuthContext = {
      org_id: apiKey.org_id,
      key_id: apiKey.id,
      scopes: apiKey.scopes,
    };

    // Build legacy identity for backwards compatibility
    const identity: Identity = {
      userId: apiKey.org_id, // Map org_id to userId for backwards compatibility
      scopes: apiKey.scopes,
      entitlements: await lookupEntitlements(apiKey.org_id),
    };

    return { auth, identity };
  }

  return null;
}

/**
 * Lookup API key from database by hash
 */
async function lookupApiKey(keyValue: string): Promise<ApiKeyRecord | null> {
  // Hash the incoming key for lookup
  const keyHash = hashApiKey(keyValue);

  const result = await db.query(
    `
    SELECT *
    FROM api_keys
    WHERE key_hash = $1
      AND is_active = true
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    `,
    [keyHash]
  );

  const record = result.rows[0];

  if (!record) {
    return null;
  }

  // Map database row to ApiKeyRecord interface
  return {
    id: record.id,
    org_id: record.org_id,
    name: record.name,
    scopes: record.scopes,
    key_hash: record.key_hash,
    created_at: record.created_at,
    expires_at: record.expires_at,
    revoked: record.revoked_at !== null,
    last_used_at: record.last_used_at,
  };
}

/**
 * Lookup organization entitlements
 * MVP: Returns default developer tier
 */
async function lookupEntitlements(orgId: string): Promise<Entitlements> {
  // MVP: Return from in-memory store or default
  // Production: Query from entitlement database

  const entitlement = entitlementStore.get(orgId);

  if (entitlement) {
    return entitlement;
  }

  // Default to developer tier for API key auth
  return {
    plan: 'developer',
    maxRequests: 10000,
    maxTokens: 1000000,
    maxApiKeys: 10,
  };
}

/**
 * Check if a route is a UI route that accepts Supabase JWT
 */
function isUIRoute(url: string): boolean {
  // Remove query string for matching
  const path = url.split('?')[0];
  return UI_ROUTES.some(route => path === route || path.startsWith(route + '/'));
}

/**
 * Verify Supabase JWT and return user info
 * Uses HS256 algorithm as required by Supabase
 */
interface SupabaseJWTPayload {
  sub: string;  // User ID
  email?: string;
  exp: number;
  iat: number;
}

async function verifySupabaseJWT(token: string): Promise<SupabaseJWTPayload | null> {
  const secret = process.env.SUPABASE_JWT_SECRET;

  if (!secret) {
    console.error('SUPABASE_JWT_SECRET is not configured');
    return null;
  }

  try {
    // CRITICAL: Use explicit HS256 algorithm
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as SupabaseJWTPayload;

    return payload;
  } catch (error) {
    // JWT verification failed (expired, invalid signature, etc.)
    return null;
  }
}

/**
 * Get or create organization for a Supabase user
 */
async function getOrCreateOrg(userId: string): Promise<string | null> {
  try {
    // Try to find existing org
    const result = await db.query(
      'SELECT id FROM organizations WHERE owner_user_id = $1',
      [userId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].id;
    }

    // Create new org for this user
    const insertResult = await db.query(
      'INSERT INTO organizations (owner_user_id) VALUES ($1) RETURNING id',
      [userId]
    );

    return insertResult.rows[0].id;
  } catch (error) {
    console.error('Failed to get/create org:', error);
    return null;
  }
}

/**
 * Authentication middleware for Fastify
 *
 * Auth order:
 * 1. Check if Supabase JWT (for UI routes)
 * 2. Check if API key (for machine routes)
 * 3. Reject if neither
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authorization header required',
      request_id: request.id,
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  // 1️⃣ FIRST: Check if this is a Supabase JWT (for UI routes)
  // Supabase JWT: does NOT start with "agentics_"
  if (!token.startsWith('agentics_')) {
    // This is a Supabase JWT - verify it
    const payload = await verifySupabaseJWT(token);

    if (!payload) {
      reply.status(401).send({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        message: 'JWT verification failed',
        request_id: request.id,
      });
      return;
    }

    // Get org for this user
    const orgId = await getOrCreateOrg(payload.sub);

    if (!orgId) {
      reply.status(401).send({
        error: 'Organization error',
        code: 'ORG_ERROR',
        message: 'Failed to resolve organization',
        request_id: request.id,
      });
      return;
    }

    // Attach auth context for Supabase JWT users
    request.auth = {
      org_id: orgId,
      key_id: 'supabase_jwt', // Marker for JWT auth
      scopes: ['admin'], // UI users get admin scope
    };

    request.identity = {
      userId: orgId,
      email: payload.email,
      scopes: ['admin'],
      entitlements: await lookupEntitlements(orgId),
    };

    return; // Success - proceed to route handler
  }

  // 2️⃣ SECOND: Check if this is an API key
  const credentials = extractCredentials(request);
  const result = await validateCredentials(credentials);

  if (!result) {
    reply.status(401).send({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Valid API key required. Use Authorization: Bearer <api_key>',
      request_id: request.id,
    });
    return;
  }

  // Attach auth context and identity to request
  request.auth = result.auth;
  request.identity = result.identity;
}

// ============================================================================
// In-Memory Stores for MVP
// Note: API key lookup now uses Postgres via DATABASE_URL
// ============================================================================

// Store entitlements by org_id (still in-memory for MVP)
const entitlementStore = new Map<string, Entitlements>();

/**
 * Set entitlements for an organization
 */
export function setEntitlements(orgId: string, entitlements: Entitlements): void {
  entitlementStore.set(orgId, entitlements);
}

/**
 * Clear all entitlements (for testing)
 */
export function clearEntitlements(): void {
  entitlementStore.clear();
}
