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
import jwksClient from 'jwks-rsa';
import { db } from '../db.js';

// Supabase JWKS client for ES256 verification
// Support both backend (SUPABASE_URL) and legacy (NEXT_PUBLIC_SUPABASE_URL) env vars
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mhxrmdhardaqexpuigci.supabase.co';
const jwks = jwksClient({
  jwksUri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes - cache signing keys
  rateLimit: true,
  jwksRequestsPerMinute: 10, // Limit JWKS fetches to prevent abuse
  timeout: 30000, // 30 second timeout for JWKS fetch
});

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
 * Extract API key from request headers.
 *
 * Checks in order:
 * 1. Authorization: Bearer agentics_* (existing path)
 * 2. X-API-Key header with agentics_sk_* or agentics_internal_* prefix
 */
export function extractCredentials(request: FastifyRequest): Credentials | null {
  // 1. Check Authorization: Bearer header
  const authHeader = request.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();

    if (token.startsWith('agentics_')) {
      return {
        type: 'api_key',
        value: token,
      };
    }
  }

  // 2. Check X-API-Key header
  const xApiKey = request.headers['x-api-key'] as string | undefined;
  if (xApiKey && (xApiKey.startsWith('agentics_sk_') || xApiKey.startsWith('agentics_internal_'))) {
    return {
      type: 'api_key',
      value: xApiKey,
    };
  }

  return null;
}

// GCP JWKS client for identity token verification
// Supports developers/CI who authenticate with gcloud identity tokens
const gcpJwks = jwksClient({
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  cache: true,
  cacheMaxAge: 600000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  timeout: 30000,
});

/**
 * GCP identity token payload
 */
export interface GcpIdentityPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Verify a GCP identity token against Google's JWKS
 * Returns the token payload if valid, null otherwise.
 *
 * This preserves the existing behavior for developers/CI who use
 * `gcloud auth print-identity-token` to authenticate requests.
 */
export async function verifyGcpIdentityToken(token: string): Promise<GcpIdentityPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const headerBase64 = parts[0];
    const header = JSON.parse(Buffer.from(headerBase64, 'base64url').toString());

    if (!header.kid) {
      return null;
    }

    const signingKey = await gcpJwks.getSigningKey(header.kid);
    const publicKey = signingKey.getPublicKey();

    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    }) as GcpIdentityPayload;

    return payload;
  } catch {
    return null;
  }
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
export async function lookupEntitlements(orgId: string): Promise<Entitlements> {
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
 * Verify Supabase JWT and return user info
 * Uses ES256 algorithm with JWKS public key verification
 */
export interface SupabaseJWTPayload {
  sub: string;  // User ID
  email?: string;
  exp: number;
  iat: number;
}

export async function verifySupabaseJWT(token: string): Promise<SupabaseJWTPayload | null> {
  try {
    // Validate JWT format (must have 3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode JWT header to get the key ID
    const headerBase64 = parts[0];
    const header = JSON.parse(Buffer.from(headerBase64, 'base64url').toString());

    if (!header.kid) {
      return null;
    }

    // Get the signing key from Supabase JWKS
    const signingKey = await jwks.getSigningKey(header.kid);
    const publicKey = signingKey.getPublicKey();

    // Verify the JWT with the public key
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['ES256'],
    }) as SupabaseJWTPayload;

    return payload;
  } catch (error) {
    // JWT verification failed - invalid signature, expired, malformed, or JWKS fetch error
    return null;
  }
}

/**
 * Get or create organization for a Supabase user
 * Uses UPSERT-style logic to handle race conditions
 */
export async function getOrCreateOrg(userId: string): Promise<string | null> {
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
 * 1. Skip if already authenticated (request.auth set by global gate)
 * 2. Check if Supabase JWT (for UI routes)
 * 3. Check if API key via Bearer or X-API-Key (for machine routes)
 * 4. Reject if neither
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // If already authenticated by the global gate, skip
  if (request.auth) {
    return;
  }

  const authHeader = request.headers.authorization;

  // Check X-API-Key fallback if no Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Try X-API-Key header before rejecting
    const credentials = extractCredentials(request);
    if (credentials) {
      const result = await validateCredentials(credentials);
      if (result) {
        request.auth = result.auth;
        request.identity = result.identity;
        return;
      }
    }

    reply.status(401).send({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authorization header or X-API-Key required',
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
