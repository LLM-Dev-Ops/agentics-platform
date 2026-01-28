/**
 * Auth Session Route (GET /v1/auth/session)
 *
 * Validates an API key and returns the session contract:
 * { email, user_id, org_id, payment_status }
 *
 * This is the endpoint the CLI calls for `agentics whoami`.
 * The platform is the single source of truth for entitlement.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { extractCredentials, validateCredentials } from '../middleware/auth.js';
import { db } from '../db.js';

/**
 * Internal email domains that get payment_status: "internal"
 */
const INTERNAL_EMAIL_PATTERNS = [
  /^dev@agentics\.local$/i,
  /@agentics\.org$/i,
  /@ruv\.net$/i,
];

/**
 * Check if an email is an internal testing identity
 */
function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return INTERNAL_EMAIL_PATTERNS.some(pattern => pattern.test(email));
}

/**
 * Determine payment_status for a given email
 * - Internal emails → "internal"
 * - All other valid keys → "paid" (hardcoded for now)
 */
function getPaymentStatus(email: string | null | undefined): 'paid' | 'unpaid' | 'internal' {
  if (isInternalEmail(email)) {
    return 'internal';
  }
  // For now, all valid API key holders are treated as paid
  return 'paid';
}

/**
 * GET /v1/auth/session
 * Validates API key and returns session info for CLI
 */
async function authSessionHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const credentials = extractCredentials(request);
  const result = await validateCredentials(credentials);

  if (!result) {
    return reply.code(401).send({
      error: 'Invalid or missing API key',
      code: 'AUTHENTICATION_REQUIRED',
      authenticated: false,
      request_id: request.id,
    });
  }

  const { auth } = result;

  // Look up owner email from organizations table
  let email: string | null = null;
  let userId: string | null = null;

  try {
    const orgResult = await db.query(
      'SELECT owner_user_id, owner_email FROM organizations WHERE id = $1',
      [auth.org_id]
    );

    if (orgResult.rows.length > 0) {
      userId = orgResult.rows[0].owner_user_id;
      email = orgResult.rows[0].owner_email || null;
    }
  } catch {
    // owner_email column may not exist yet; proceed without it
  }

  const paymentStatus = getPaymentStatus(email);

  return reply.code(200).send({
    authenticated: true,
    email: email || null,
    user_id: userId || auth.org_id,
    org_id: auth.org_id,
    payment_status: paymentStatus,
    scopes: auth.scopes,
  });
}

/**
 * Register auth session routes
 */
export async function registerAuthSessionRoutes(fastify: FastifyInstance) {
  fastify.get('/auth/session', authSessionHandler);
}
