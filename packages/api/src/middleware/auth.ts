/**
 * Authentication Middleware
 * Extracts and validates credentials from Authorization header
 * Supports both API keys (Bearer agentics_...) and JWT tokens (Bearer eyJ...)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config.js';

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
  type: 'api_key' | 'bearer_token';
  value: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  scopes: string[];
  keyHash: string;
  createdAt: Date;
  expiresAt?: Date;
  revoked: boolean;
}

export interface JWTPayload {
  sub: string;
  email: string;
  scopes: string[];
  exp: number;
  iat: number;
}

// Augment Fastify request with identity
declare module 'fastify' {
  interface FastifyRequest {
    identity?: Identity;
  }
}

/**
 * Extract credentials from Authorization header
 */
export function extractCredentials(request: FastifyRequest): Credentials | null {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Determine if it's an API key or JWT
  if (token.startsWith('agentics_')) {
    return {
      type: 'api_key',
      value: token,
    };
  } else if (token.startsWith('eyJ')) {
    // JWT tokens typically start with 'eyJ' (base64 encoded JSON)
    return {
      type: 'bearer_token',
      value: token,
    };
  }

  return null;
}

/**
 * Validate credentials and return identity
 * Implements SPARC validateCredentials pseudocode
 */
export async function validateCredentials(credentials: Credentials | null): Promise<Identity | null> {
  if (!credentials) {
    return null;
  }

  if (credentials.type === 'api_key') {
    const apiKey = await lookupApiKey(credentials.value);

    if (!apiKey || apiKey.revoked) {
      return null;
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    return {
      userId: apiKey.userId,
      scopes: apiKey.scopes,
      entitlements: await lookupEntitlements(apiKey.userId),
    };
  }

  if (credentials.type === 'bearer_token') {
    const token = await verifyJWT(credentials.value);

    if (!token) {
      return null;
    }

    return {
      userId: token.sub,
      email: token.email,
      scopes: token.scopes,
      entitlements: await lookupEntitlements(token.sub),
    };
  }

  return null;
}

/**
 * Lookup API key from database
 * MVP: In-memory store (production should use database)
 */
async function lookupApiKey(keyValue: string): Promise<ApiKey | null> {
  // MVP: In-memory store for demonstration
  // Production: Query from identity database

  // For MVP, we'll use a simple map
  // In production, this would hash the key and lookup by hash
  const apiKeys = getApiKeyStore();

  for (const [hash, apiKey] of apiKeys.entries()) {
    // In production, compare hashed values
    // For MVP, we'll do direct comparison (INSECURE - just for demo)
    if (await bcrypt.compare(keyValue, hash)) {
      return apiKey;
    }
  }

  return null;
}

/**
 * Verify JWT token
 */
async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

    // Check if token is expired
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Lookup user entitlements
 * MVP: Returns default free tier
 */
async function lookupEntitlements(userId: string): Promise<Entitlements> {
  // MVP: Return default free tier
  // Production: Query from entitlement database

  const entitlementStore = getEntitlementStore();
  const entitlement = entitlementStore.get(userId);

  if (entitlement) {
    return entitlement;
  }

  // Default to free tier
  return {
    plan: 'free',
    maxRequests: 1000,
    maxTokens: 100000,
    maxApiKeys: 1,
  };
}

/**
 * Authentication middleware for Fastify
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const credentials = extractCredentials(request);
  const identity = await validateCredentials(credentials);

  if (!identity) {
    reply.status(401).send({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      request_id: request.id,
    });
    return;
  }

  // Attach identity to request
  request.identity = identity;
}

// ============================================================================
// In-Memory Stores for MVP
// Production: Replace with database queries
// ============================================================================

const apiKeyStore = new Map<string, ApiKey>();
const entitlementStore = new Map<string, Entitlements>();

function getApiKeyStore(): Map<string, ApiKey> {
  return apiKeyStore;
}

function getEntitlementStore(): Map<string, Entitlements> {
  return entitlementStore;
}

/**
 * Helper function to create API key (for testing/MVP)
 */
export async function createApiKeyForTesting(
  userId: string,
  name: string,
  scopes: string[]
): Promise<string> {
  const keyValue = `agentics_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')}`;
  const keyHash = await bcrypt.hash(keyValue, 10);

  const apiKey: ApiKey = {
    id: crypto.randomUUID(),
    userId,
    name,
    scopes,
    keyHash,
    createdAt: new Date(),
    revoked: false,
  };

  apiKeyStore.set(keyHash, apiKey);
  return keyValue;
}

/**
 * Helper function to set entitlements (for testing/MVP)
 */
export function setEntitlementsForTesting(userId: string, entitlements: Entitlements): void {
  entitlementStore.set(userId, entitlements);
}
