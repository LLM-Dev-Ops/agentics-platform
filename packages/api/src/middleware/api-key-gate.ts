/**
 * Unified Authentication Gate
 *
 * Global preHandler that enforces authentication on ALL routes
 * except explicitly public ones (health, ready, CLI auth session creation).
 *
 * Authentication methods (checked in order):
 * 1. Authorization: Bearer <supabase-jwt>  — Supabase JWT (UI/dashboard)
 * 2. Authorization: Bearer agentics_*      — API key (machine/CLI)
 * 3. X-API-Key: agentics_sk_* | agentics_internal_*  — API key (CLI without gcloud)
 * 4. Authorization: Bearer <gcp-identity-token>       — GCP identity token (developers/CI)
 *
 * If none match → 401.
 *
 * POST /v1/cli/auth/sessions is the login entry point and MUST remain
 * unauthenticated so the CLI can initiate the device flow.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  verifySupabaseJWT,
  verifyGcpIdentityToken,
  getOrCreateOrg,
  validateCredentials,
  lookupEntitlements,
} from './auth.js';

/**
 * Exact public routes (method + path must match exactly).
 */
const PUBLIC_ROUTES: Array<{ method: string; path: string }> = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/ready' },
  { method: 'POST', path: '/v1/cli/auth/sessions' },
];

/**
 * Public path prefixes. Any request whose path starts with one of these
 * is allowed through without authentication.
 */
const PUBLIC_PREFIXES: string[] = [
  // CLI device flow sub-routes (poll, verify, authorize, cancel)
  '/v1/cli/auth/sessions/',
  // Observability endpoints
  '/metrics',
  // Layer 3 health sub-routes
  '/health/',
  // Enterprise webhook (Stripe signature verification, not Bearer auth)
  '/v1/enterprise',
];

/**
 * Check whether a request targets a public route.
 */
function isPublicRoute(method: string, url: string): boolean {
  const path = url.split('?')[0];

  for (const route of PUBLIC_ROUTES) {
    if (route.method === method && route.path === path) {
      return true;
    }
  }

  for (const prefix of PUBLIC_PREFIXES) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Global authentication gate.
 *
 * Register as an `onRequest` hook on the root Fastify instance so it
 * runs before any route-specific hooks.
 */
export async function apiKeyGate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 0. Public routes — no auth required
  if (isPublicRoute(request.method, request.url)) {
    return;
  }

  // 0b. Already authenticated by a previous hook
  if (request.auth) {
    return;
  }

  const authHeader = request.headers.authorization;

  // ── 1. Authorization: Bearer <token> ──────────────────────────────
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();

    // 1a. Agentics API key (Bearer agentics_*)
    if (token.startsWith('agentics_')) {
      const result = await validateCredentials({ type: 'api_key', value: token });
      if (result) {
        request.auth = result.auth;
        request.identity = result.identity;
        return;
      }
      reply.status(401).send({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
        request_id: request.id,
      });
      return;
    }

    // 1b. Supabase JWT (non-agentics_ Bearer token)
    const jwtPayload = await verifySupabaseJWT(token);
    if (jwtPayload) {
      const orgId = await getOrCreateOrg(jwtPayload.sub);
      if (orgId) {
        request.auth = {
          org_id: orgId,
          key_id: 'supabase_jwt',
          scopes: ['admin'],
        };
        request.identity = {
          userId: orgId,
          email: jwtPayload.email,
          scopes: ['admin'],
          entitlements: await lookupEntitlements(orgId),
        };
        return;
      }
    }

    // 1c. GCP identity token (RS256 JWT signed by Google)
    const gcpPayload = await verifyGcpIdentityToken(token);
    if (gcpPayload) {
      request.auth = {
        org_id: `gcp:${gcpPayload.email || gcpPayload.sub}`,
        key_id: 'gcp_identity_token',
        scopes: ['admin'],
      };
      return;
    }

    // Bearer token present but none of the above succeeded
    reply.status(401).send({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
      request_id: request.id,
    });
    return;
  }

  // ── 2. X-API-Key header ───────────────────────────────────────────
  const xApiKey = request.headers['x-api-key'] as string | undefined;
  if (xApiKey) {
    // Validate prefix
    if (!xApiKey.startsWith('agentics_sk_') && !xApiKey.startsWith('agentics_internal_')) {
      reply.status(401).send({
        error: 'Invalid API key format',
        code: 'INVALID_API_KEY_FORMAT',
        message: 'X-API-Key must start with agentics_sk_ or agentics_internal_',
        request_id: request.id,
      });
      return;
    }

    // Validate against database
    const result = await validateCredentials({ type: 'api_key', value: xApiKey });
    if (result) {
      request.auth = result.auth;
      request.identity = result.identity;
      return;
    }

    reply.status(401).send({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
      request_id: request.id,
    });
    return;
  }

  // ── 3. No credentials provided ────────────────────────────────────
  reply.status(401).send({
    error: 'Authentication required',
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Provide Authorization: Bearer <token> or X-API-Key header',
    request_id: request.id,
  });
}
