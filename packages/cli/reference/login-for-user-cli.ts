/**
 * Login Command for End-User CLI (agentics-cli)
 *
 * Implements the OAuth 2.0 Device Authorization Flow:
 * 1. CLI calls API to create authentication session
 * 2. API returns session_code and verification URL
 * 3. CLI opens browser to verification URL
 * 4. User authenticates in browser and approves access
 * 5. CLI polls API until session is completed
 * 6. CLI receives API key automatically (no copy-paste!)
 *
 * Copy this file to: agentics-cli/src/commands/login.ts
 */

import { AuthError } from '../errors/index.js';
import { createCredentialStore } from '../utils/credentials.js';
import { hostname } from 'node:os';

// ============================================================================
// Configuration
// ============================================================================

/**
 * API endpoint for authentication
 * Can be overridden with AGENTICS_API_URL environment variable
 */
const API_URL = process.env['AGENTICS_API_URL'] ?? 'https://platform.agentics.dev/v1';

/**
 * CLI identification
 */
const CLI_NAME = 'Agentics CLI';
const CLI_VERSION = '1.2.3'; // Update this with your package version

// ============================================================================
// Types
// ============================================================================

interface SessionResponse {
  session_code: string;
  device_code: string;
  verification_url: string;
  expires_at: string;
  expires_in_seconds: number;
  poll_interval_seconds: number;
  message: string;
}

interface PollResponse {
  status: 'pending' | 'authorized' | 'completed';
  api_key?: string;
  message: string;
}

interface LoginInput {
  noBrowser?: boolean;
}

interface LoginOptions {
  trace_id?: string;
  verbose?: boolean;
}

// ============================================================================
// Login Command Implementation
// ============================================================================

export async function executeLoginCommand(
  input: LoginInput,
  options: LoginOptions
): Promise<{ success: boolean; message: string; credentialsPath?: string }> {
  const correlationId = options.trace_id ?? crypto.randomUUID();
  const credentialStore = createCredentialStore();

  // Check if already authenticated
  const existingCredentials = await credentialStore.load();
  if (existingCredentials && options.verbose) {
    console.error('Existing credentials found. Re-authenticating...');
  }

  // Step 1: Create authentication session via API
  console.log('');
  console.log('Initializing authentication...');

  let session: SessionResponse;
  try {
    const response = await fetch(`${API_URL}/cli/auth/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cli_name: CLI_NAME,
        cli_version: CLI_VERSION,
        hostname: hostname(),
        scopes: ['platform:read', 'platform:write'],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new AuthError({
        type: 'network',
        message: error.error || `Failed to create auth session: ${response.status}`,
        correlationId,
      });
    }

    session = await response.json() as SessionResponse;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError({
      type: 'network',
      message: `Failed to connect to API: ${err instanceof Error ? err.message : 'Unknown error'}`,
      correlationId,
    });
  }

  // Step 2: Display the verification URL
  console.log('');
  console.log('To authenticate, visit:');
  console.log('');
  console.log(`  \x1b[1m\x1b[4m${session.verification_url}\x1b[0m`);
  console.log('');
  console.log(`Session code: \x1b[1m${session.session_code}\x1b[0m`);
  console.log('');

  // Step 3: Open browser automatically (unless --no-browser)
  if (!input.noBrowser) {
    const browserOpened = await openBrowser(session.verification_url, options);
    if (browserOpened) {
      console.log('Browser opened automatically.');
    } else {
      console.log('Could not open browser. Please visit the URL above manually.');
    }
    console.log('');
  }

  // Step 4: Poll for completion
  console.log('Waiting for authentication...');

  const pollInterval = (session.poll_interval_seconds || 5) * 1000;
  const maxAttempts = Math.ceil((session.expires_in_seconds || 600) / (pollInterval / 1000));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);

    try {
      const response = await fetch(`${API_URL}/cli/auth/sessions/${session.device_code}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ code: 'UNKNOWN' }));

        if (error.code === 'SESSION_EXPIRED') {
          throw new AuthError({
            type: 'expired',
            message: 'Authentication session expired. Please run `agentics login` again.',
            correlationId,
          });
        }

        if (error.code === 'SESSION_CANCELLED') {
          throw new AuthError({
            type: 'cancelled',
            message: 'Authentication was cancelled. Run `agentics login` to try again.',
            correlationId,
          });
        }

        // Other errors - continue polling
        if (options.verbose) {
          console.error(`Poll error: ${error.error || response.status}`);
        }
        continue;
      }

      const result = await response.json() as PollResponse;

      if (result.status === 'pending') {
        // Still waiting for user to authorize
        if (options.verbose) {
          process.stdout.write('.');
        }
        continue;
      }

      if (result.status === 'authorized') {
        // User authorized, API key being generated
        console.log('Authorization received, generating API key...');
        continue;
      }

      if (result.status === 'completed' && result.api_key) {
        // Success! Store the API key
        await credentialStore.save({
          api_key: result.api_key,
          created_at: new Date().toISOString(),
        });

        const credentialsPath = credentialStore.getCredentialsPath?.() ?? '~/.agentics/credentials.json';

        console.log('');
        console.log('\x1b[32m✓ Authentication successful!\x1b[0m');
        console.log(`  API key stored at: ${credentialsPath}`);
        console.log('');
        console.log('You can now use Agentics CLI commands.');

        return {
          success: true,
          message: 'Authentication successful',
          credentialsPath,
        };
      }

      if (result.status === 'completed') {
        // Completed but no API key (already retrieved)
        throw new AuthError({
          type: 'invalid',
          message: 'Session already completed. Please run `agentics login` again.',
          correlationId,
        });
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      // Network error - continue polling
      if (options.verbose) {
        console.error(`Network error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
      continue;
    }
  }

  // Timed out
  throw new AuthError({
    type: 'expired',
    message: 'Authentication timed out. Please run `agentics login` again.',
    correlationId,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openBrowser(url: string, options: LoginOptions): Promise<boolean> {
  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    const platform = process.platform;
    let command: string;

    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else {
      // Linux and others
      command = `xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || x-www-browser "${url}" 2>/dev/null`;
    }

    await execAsync(command);

    if (options.verbose) {
      console.error('Opened browser for authentication');
    }

    return true;
  } catch {
    if (options.verbose) {
      console.error('Could not open browser automatically');
    }
    return false;
  }
}
