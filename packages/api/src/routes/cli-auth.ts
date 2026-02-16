/**
 * CLI Authentication Routes
 *
 * Implements the browser-based authentication flow for CLI tools.
 * This mirrors the Claude.ai and GitHub CLI device flow pattern:
 *
 * 1. CLI calls POST /v1/cli/auth/sessions to get a session_code and device_code
 * 2. CLI opens browser to /cli/auth?code=<session_code>
 * 3. User authenticates in browser (Supabase) and approves CLI access
 * 4. Platform creates API key and marks session as completed
 * 5. CLI polls GET /v1/cli/auth/sessions/:device_code until authorized
 * 6. CLI receives API key and stores it locally
 *
 * ARCHITECTURAL CONSTRAINT:
 * The platform URL MUST be explicitly configured via AGENTICS_PLATFORM_URL or PLATFORM_URL
 * environment variable. Implicit defaults are prohibited in production to prevent
 * domain misconfiguration (e.g., agentics.org vs agentics.dev).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { db } from '../db.js';
import { verifySupabaseJWT, getOrCreateOrg, hashApiKey } from '../middleware/auth.js';

/**
 * Determine payment_status for an org based on stripe_metering_enabled and email
 */
function resolvePaymentStatus(org: { stripe_metering_enabled?: boolean; owner_email?: string | null }): 'paid' | 'unpaid' | 'trial' | 'internal' {
  // Internal testing emails
  if (org.owner_email && /^dev@agentics\.local$/i.test(org.owner_email)) {
    return 'internal';
  }
  if (org.stripe_metering_enabled) {
    return 'paid';
  }
  // Default: treat valid key holders as trial until billing is wired
  return 'trial';
}

/**
 * Canonical domain for Agentics Platform
 * This is the ONLY place the production domain should be defined
 */
const AGENTICS_DOMAIN = 'agentics.dev';

/**
 * Environment variable names for platform URL configuration
 */
const PLATFORM_URL_ENV_VARS = ['AGENTICS_PLATFORM_URL', 'PLATFORM_URL'] as const;

/**
 * Get the platform URL with fail-fast validation
 *
 * In production, this REQUIRES an environment variable to be set.
 * This prevents silent fallback to incorrect domains.
 *
 * @throws Error if URL is not configured in production
 */
function getPlatformUrl(): string {
  // Check environment variables in priority order
  for (const envVar of PLATFORM_URL_ENV_VARS) {
    const url = process.env[envVar];
    if (url) {
      // Validate URL format
      try {
        const parsed = new URL(url);
        // Validate protocol
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error(`Invalid protocol: ${parsed.protocol}. Must be http or https.`);
        }
        return url;
      } catch (err) {
        throw new Error(
          `Invalid ${envVar} value "${url}": ${err instanceof Error ? err.message : 'Invalid URL format'}`
        );
      }
    }
  }

  // In development/test, allow default
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  if (isDevelopment) {
    return `https://app.${AGENTICS_DOMAIN}`;
  }

  // In production, FAIL FAST - do not silently use a default
  throw new Error(
    `Platform URL not configured. ` +
    `Set ${PLATFORM_URL_ENV_VARS[0]} or ${PLATFORM_URL_ENV_VARS[1]} environment variable ` +
    `to the public platform URL (e.g., https://app.${AGENTICS_DOMAIN}). ` +
    `Implicit defaults are prohibited in production to prevent domain misconfiguration. ` +
    `See architecture/CLI_AUTH_FLOW.md for details.`
  );
}

/**
 * Validate platform URL configuration at module load time
 * This ensures fast failure before any requests are processed
 */
let _cachedPlatformUrl: string | null = null;
function getValidatedPlatformUrl(): string {
  if (_cachedPlatformUrl === null) {
    _cachedPlatformUrl = getPlatformUrl();
    console.log(`[CLI Auth] Platform URL configured: ${_cachedPlatformUrl}`);
  }
  return _cachedPlatformUrl;
}

/**
 * Generate a cryptographically secure random string
 */
function generateSecureCode(length: number): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

/**
 * Generate a user-friendly session code (short, easy to verify)
 */
function generateSessionCode(): string {
  // 8 characters, alphanumeric, easy to read
  return generateSecureCode(8).toUpperCase();
}

/**
 * Generate a device code (longer, for CLI polling)
 */
function generateDeviceCode(): string {
  // 32 characters, secure random
  return generateSecureCode(32);
}

/**
 * Generate a new API key for CLI
 * Format: agentics_sk_cli_<random_hex_32>
 */
function generateCliApiKey(): string {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `agentics_sk_cli_${randomBytes}`;
}

/**
 * POST /v1/cli/auth/sessions
 * Create a new CLI authentication session
 *
 * Called by CLI to initiate browser-based auth flow
 */
async function createSessionHandler(
  request: FastifyRequest<{
    Body: {
      cli_name?: string;
      cli_version?: string;
      hostname?: string;
      scopes?: string[];
    };
  }>,
  reply: FastifyReply
) {
  const { cli_name, cli_version, hostname, scopes } = request.body || {};

  const sessionCode = generateSessionCode();
  const deviceCode = generateDeviceCode();

  // Get client IP and user agent for audit trail
  const ipAddress = request.ip || null;
  const userAgent = request.headers['user-agent'] || null;

  // Default scopes if not specified
  const requestedScopes = scopes && scopes.length > 0 ? scopes : ['platform:read', 'platform:write'];

  try {
    const result = await db.query(
      `
      INSERT INTO cli_auth_sessions (
        session_code,
        device_code,
        cli_name,
        cli_version,
        hostname,
        ip_address,
        user_agent,
        requested_scopes,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + INTERVAL '10 minutes')
      RETURNING id, session_code, device_code, expires_at
      `,
      [
        sessionCode,
        deviceCode,
        cli_name || 'Agentics CLI',
        cli_version || null,
        hostname || null,
        ipAddress,
        userAgent,
        requestedScopes,
      ]
    );

    const session = result.rows[0];

    // Build the verification URL using validated platform URL
    // This will fail fast if AGENTICS_PLATFORM_URL or PLATFORM_URL is not configured in production
    const platformUrl = getValidatedPlatformUrl();
    const verificationUrl = `${platformUrl}/cli/auth?code=${session.session_code}`;

    return reply.code(201).send({
      session_code: session.session_code,
      device_code: session.device_code,
      verification_url: verificationUrl,
      expires_at: session.expires_at,
      expires_in_seconds: 600, // 10 minutes
      poll_interval_seconds: 5,
      message: `Visit ${verificationUrl} to authenticate`,
    });
  } catch (error) {
    request.log.error({ error }, 'Failed to create CLI auth session');
    return reply.code(500).send({
      error: 'Failed to create authentication session',
      code: 'SESSION_CREATE_ERROR',
      request_id: request.id,
    });
  }
}

/**
 * GET /v1/cli/auth/sessions/:device_code
 * Poll for session status
 *
 * Called by CLI to check if user has authorized and get the API key
 */
async function pollSessionHandler(
  request: FastifyRequest<{
    Params: {
      device_code: string;
    };
  }>,
  reply: FastifyReply
) {
  const { device_code } = request.params;

  try {
    const result = await db.query(
      `
      SELECT
        s.id,
        s.status,
        s.expires_at,
        s.authorized_org_id,
        k.id as api_key_id,
        o.owner_email,
        o.stripe_metering_enabled
      FROM cli_auth_sessions s
      LEFT JOIN api_keys k ON k.id = s.api_key_id
      LEFT JOIN organizations o ON o.id = s.authorized_org_id
      WHERE s.device_code = $1
      `,
      [device_code]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
        request_id: request.id,
      });
    }

    const session = result.rows[0];

    // Check if session has expired
    if (new Date(session.expires_at) < new Date()) {
      // Mark as expired if still pending
      if (session.status === 'pending') {
        await db.query(
          `UPDATE cli_auth_sessions SET status = 'expired' WHERE id = $1`,
          [session.id]
        );
      }
      return reply.code(400).send({
        error: 'Session has expired',
        code: 'SESSION_EXPIRED',
        request_id: request.id,
      });
    }

    // Return status based on session state
    switch (session.status) {
      case 'pending':
        return reply.code(200).send({
          status: 'pending',
          message: 'Waiting for user authorization',
        });

      case 'authorized':
        return reply.code(200).send({
          status: 'authorized',
          message: 'User authorized, generating API key...',
        });

      case 'completed':
        // Fetch the API key to return (this is the only time it's shown)
        // We need to get the plaintext key from a temporary store
        // For security, we stored a one-time token in the session
        const tokenResult = await db.query(
          `
          SELECT api_key_plaintext
          FROM cli_auth_sessions
          WHERE id = $1 AND status = 'completed'
          `,
          [session.id]
        );

        if (tokenResult.rows.length === 0 || !tokenResult.rows[0].api_key_plaintext) {
          return reply.code(200).send({
            status: 'completed',
            message: 'API key already retrieved',
          });
        }

        const apiKey = tokenResult.rows[0].api_key_plaintext;

        // Clear the plaintext key after retrieval (one-time only)
        await db.query(
          `UPDATE cli_auth_sessions SET api_key_plaintext = NULL WHERE id = $1`,
          [session.id]
        );

        // Build enriched response with user identity
        const paymentStatus = resolvePaymentStatus({
          stripe_metering_enabled: session.stripe_metering_enabled,
          owner_email: session.owner_email,
        });

        return reply.code(200).send({
          status: 'completed',
          api_key: apiKey,
          email: session.owner_email || null,
          payment_status: paymentStatus,
          org: session.authorized_org_id || null,
          role: 'owner',
          message: 'Authentication successful',
        });

      case 'cancelled':
        return reply.code(400).send({
          error: 'Session was cancelled by user',
          code: 'SESSION_CANCELLED',
          request_id: request.id,
        });

      case 'expired':
        return reply.code(400).send({
          error: 'Session has expired',
          code: 'SESSION_EXPIRED',
          request_id: request.id,
        });

      default:
        return reply.code(500).send({
          error: 'Unknown session status',
          code: 'UNKNOWN_STATUS',
          request_id: request.id,
        });
    }
  } catch (error) {
    request.log.error({ error }, 'Failed to poll CLI auth session');
    return reply.code(500).send({
      error: 'Failed to check session status',
      code: 'SESSION_POLL_ERROR',
      request_id: request.id,
    });
  }
}

/**
 * GET /v1/cli/auth/sessions/verify/:session_code
 * Get session details for browser verification page
 *
 * Called by browser to display session details before authorization
 */
async function verifySessionHandler(
  request: FastifyRequest<{
    Params: {
      session_code: string;
    };
  }>,
  reply: FastifyReply
) {
  const { session_code } = request.params;

  try {
    const result = await db.query(
      `
      SELECT
        id,
        status,
        cli_name,
        cli_version,
        hostname,
        ip_address,
        requested_scopes,
        created_at,
        expires_at
      FROM cli_auth_sessions
      WHERE session_code = $1
      `,
      [session_code]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
        request_id: request.id,
      });
    }

    const session = result.rows[0];

    // Check if session has expired
    if (new Date(session.expires_at) < new Date()) {
      return reply.code(400).send({
        error: 'Session has expired',
        code: 'SESSION_EXPIRED',
        request_id: request.id,
      });
    }

    // Check if session is still pending
    if (session.status !== 'pending') {
      return reply.code(400).send({
        error: `Session is already ${session.status}`,
        code: 'SESSION_INVALID_STATUS',
        request_id: request.id,
      });
    }

    return reply.code(200).send({
      session_code: session_code,
      cli_name: session.cli_name,
      cli_version: session.cli_version,
      hostname: session.hostname,
      ip_address: session.ip_address,
      requested_scopes: session.requested_scopes,
      created_at: session.created_at,
      expires_at: session.expires_at,
    });
  } catch (error) {
    request.log.error({ error }, 'Failed to verify CLI auth session');
    return reply.code(500).send({
      error: 'Failed to verify session',
      code: 'SESSION_VERIFY_ERROR',
      request_id: request.id,
    });
  }
}

/**
 * POST /v1/cli/auth/sessions/:session_code/authorize
 * Authorize the CLI session and generate API key
 *
 * Called by browser after user authenticates with Supabase
 * Requires Supabase JWT authentication
 */
async function authorizeSessionHandler(
  request: FastifyRequest<{
    Params: {
      session_code: string;
    };
    Body: {
      key_name?: string;
      scopes?: string[];
    };
  }>,
  reply: FastifyReply
) {
  const { session_code } = request.params;
  const { key_name, scopes: overrideScopes } = request.body || {};

  // Verify Supabase JWT
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      request_id: request.id,
    });
  }

  const token = authHeader.substring(7);

  // Must be a Supabase JWT (not an API key)
  if (token.startsWith('agentics_')) {
    return reply.code(401).send({
      error: 'Browser authentication required',
      code: 'JWT_REQUIRED',
      request_id: request.id,
    });
  }

  const user = await verifySupabaseJWT(token);
  if (!user) {
    return reply.code(401).send({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
      request_id: request.id,
    });
  }

  // Get or create org for this user
  const orgId = await getOrCreateOrg(user.sub);
  if (!orgId) {
    return reply.code(500).send({
      error: 'Failed to resolve organization',
      code: 'ORG_ERROR',
      request_id: request.id,
    });
  }

  try {
    // Start transaction
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Get and lock the session
      const sessionResult = await client.query(
        `
        SELECT id, status, requested_scopes, expires_at
        FROM cli_auth_sessions
        WHERE session_code = $1
        FOR UPDATE
        `,
        [session_code]
      );

      if (sessionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
          request_id: request.id,
        });
      }

      const session = sessionResult.rows[0];

      // Validate session state
      if (new Date(session.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return reply.code(400).send({
          error: 'Session has expired',
          code: 'SESSION_EXPIRED',
          request_id: request.id,
        });
      }

      if (session.status !== 'pending') {
        await client.query('ROLLBACK');
        return reply.code(400).send({
          error: `Session is already ${session.status}`,
          code: 'SESSION_INVALID_STATUS',
          request_id: request.id,
        });
      }

      // Generate API key
      const plaintextKey = generateCliApiKey();
      const keyHash = hashApiKey(plaintextKey);

      // Determine final scopes (use override if provided, else session's requested scopes)
      const finalScopes = overrideScopes && overrideScopes.length > 0
        ? overrideScopes
        : session.requested_scopes;

      // Create API key
      const keyResult = await client.query(
        `
        INSERT INTO api_keys (
          key_hash,
          org_id,
          name,
          scopes,
          is_active,
          created_at
        )
        VALUES ($1, $2, $3, $4, true, now())
        RETURNING id, name, scopes, created_at
        `,
        [
          keyHash,
          orgId,
          key_name || `CLI Key (${new Date().toLocaleDateString()})`,
          finalScopes,
        ]
      );

      const apiKey = keyResult.rows[0];

      // Store user email in organizations table for API key session lookups
      if (user.email) {
        await client.query(
          `UPDATE organizations SET owner_email = $1 WHERE id = $2`,
          [user.email, orgId]
        );
      }

      // Update session with authorization and API key
      // Store plaintext key temporarily for one-time retrieval by CLI
      await client.query(
        `
        UPDATE cli_auth_sessions
        SET
          status = 'completed',
          authorized_user_id = $1,
          authorized_org_id = $2,
          api_key_id = $3,
          api_key_plaintext = $4,
          authorized_at = now(),
          completed_at = now()
        WHERE id = $5
        `,
        [user.sub, orgId, apiKey.id, plaintextKey, session.id]
      );

      await client.query('COMMIT');

      return reply.code(200).send({
        success: true,
        message: 'CLI authorization successful',
        api_key: {
          id: apiKey.id,
          name: apiKey.name,
          key: plaintextKey, // Return key for browser display (shown once, then user copies it)
          scopes: apiKey.scopes,
          created_at: apiKey.created_at,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    request.log.error({ error }, 'Failed to authorize CLI session');
    return reply.code(500).send({
      error: 'Failed to authorize session',
      code: 'AUTHORIZATION_ERROR',
      request_id: request.id,
    });
  }
}

/**
 * POST /v1/cli/auth/sessions/:session_code/cancel
 * Cancel a pending CLI session
 *
 * Called by browser if user declines authorization
 */
async function cancelSessionHandler(
  request: FastifyRequest<{
    Params: {
      session_code: string;
    };
  }>,
  reply: FastifyReply
) {
  const { session_code } = request.params;

  try {
    const result = await db.query(
      `
      UPDATE cli_auth_sessions
      SET status = 'cancelled'
      WHERE session_code = $1 AND status = 'pending'
      RETURNING id
      `,
      [session_code]
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: 'Session not found or already processed',
        code: 'SESSION_NOT_FOUND',
        request_id: request.id,
      });
    }

    return reply.code(200).send({
      success: true,
      message: 'Session cancelled',
    });
  } catch (error) {
    request.log.error({ error }, 'Failed to cancel CLI auth session');
    return reply.code(500).send({
      error: 'Failed to cancel session',
      code: 'SESSION_CANCEL_ERROR',
      request_id: request.id,
    });
  }
}

/**
 * Register CLI authentication routes
 */
export async function registerCliAuthRoutes(fastify: FastifyInstance) {
  // POST /cli/auth/sessions - Create new CLI auth session (public)
  fastify.post('/cli/auth/sessions', {
    handler: createSessionHandler,
  });

  // GET /cli/auth/sessions/:device_code - Poll for session status (public)
  fastify.get('/cli/auth/sessions/:device_code', {
    handler: pollSessionHandler,
  });

  // GET /cli/auth/sessions/verify/:session_code - Get session details for browser (public)
  fastify.get('/cli/auth/sessions/verify/:session_code', {
    handler: verifySessionHandler,
  });

  // POST /cli/auth/sessions/:session_code/authorize - Authorize session (requires Supabase JWT)
  fastify.post('/cli/auth/sessions/:session_code/authorize', {
    handler: authorizeSessionHandler,
  });

  // POST /cli/auth/sessions/:session_code/cancel - Cancel session (public)
  fastify.post('/cli/auth/sessions/:session_code/cancel', {
    handler: cancelSessionHandler,
  });
}
