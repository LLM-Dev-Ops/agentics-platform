/**
 * Authentication Middleware
 * Extracts and validates API keys from Authorization header
 *
 * API keys are passed via: Authorization: Bearer <api_key>
 * Keys are stored hashed (SHA-256), belong to an organization, have scopes, and can be revoked.
 *
 * Auth context attached to request: { org_id, key_id, scopes }
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import config from '../config.js';
import { db } from '../db.js';

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
 * Authentication middleware for Fastify
 * Validates API key and attaches auth context to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
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
