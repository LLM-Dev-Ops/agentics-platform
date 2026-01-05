/**
 * Login Command for Agentics CLI
 *
 * Authenticates the user and stores credentials.
 *
 * Supports three authentication methods:
 * 1. Browser-based auth (default, recommended) - Opens browser for secure auth
 * 2. API key - Directly provide an existing API key
 * 3. Email/password - Traditional authentication (legacy)
 *
 * The browser-based flow mirrors Claude.ai's authentication experience:
 * - CLI generates a one-time verification URL
 * - User authenticates in browser (Supabase)
 * - Platform creates an API key bound to user/org
 * - CLI polls for completion and receives the key
 */

import { Command } from 'commander';
import { createClient, handleError } from '../client.js';
import { setApiKey, setIdentity, getEndpoint } from '../config.js';
import { success, spinner, info, error as displayError, warning } from '../output.js';
import { hostname } from 'os';

/**
 * Prompt for user input
 */
async function prompt(question: string): Promise<string> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Prompt for password (hidden input)
 */
async function promptPassword(question: string): Promise<string> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // Hide input
    const stdin = process.stdin;
    const originalRawMode = stdin.isRaw;
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }

    process.stdout.write(question);
    let password = '';

    stdin.on('data', function onData(char: Buffer) {
      const c = char.toString('utf8');

      switch (c) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl-D
          stdin.removeListener('data', onData);
          if (stdin.setRawMode) {
            stdin.setRawMode(originalRawMode);
          }
          rl.close();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl-C
          process.exit(1);
          break;
        case '\u007f': // Backspace
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(question + '*'.repeat(password.length));
          }
          break;
        default:
          password += c;
          process.stdout.write('*');
          break;
      }
    });
  });
}

/**
 * CLI auth session response
 */
interface CliAuthSessionResponse {
  session_code: string;
  device_code: string;
  verification_url: string;
  expires_at: string;
  expires_in_seconds: number;
  poll_interval_seconds: number;
  message: string;
}

/**
 * CLI auth poll response
 */
interface CliAuthPollResponse {
  status: 'pending' | 'authorized' | 'completed';
  api_key?: string;
  message: string;
}

/**
 * Open a URL in the default browser
 */
async function openBrowser(url: string): Promise<boolean> {
  try {
    // Dynamic import to handle platform differences
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const platform = process.platform;
    let command: string;

    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else {
      // Linux and other Unix-like systems
      command = `xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}"`;
    }

    await execAsync(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate that the endpoint URL is properly configured
 */
function validateEndpoint(endpoint: string): void {
  // Check for localhost/internal URLs in production contexts
  const url = new URL(endpoint);

  // Warn about localhost if not explicitly set via env var
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    if (!process.env.AGENTICS_ENDPOINT) {
      warning('Using localhost endpoint. Set AGENTICS_ENDPOINT for production use.');
    }
  }

  // Validate URL scheme
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Invalid endpoint protocol: ${url.protocol}. Must be http or https.`);
  }

  // Warn about non-HTTPS in production
  if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    warning('Using insecure HTTP endpoint. Consider using HTTPS for production.');
  }
}

/**
 * Browser-based login handler
 * Implements device flow similar to Claude.ai and GitHub CLI
 */
async function browserLoginHandler(options: {
  noBrowser?: boolean;
}): Promise<void> {
  const endpoint = getEndpoint();

  // Validate endpoint configuration
  try {
    validateEndpoint(endpoint);
  } catch (err) {
    displayError(`Invalid endpoint configuration: ${err instanceof Error ? err.message : 'Unknown error'}`);
    displayError(`Current endpoint: ${endpoint}`);
    displayError('Set AGENTICS_ENDPOINT environment variable to override.');
    process.exit(1);
  }

  // Create a new CLI auth session
  const initSpinner = spinner('Initializing authentication...');

  let session: CliAuthSessionResponse;
  try {
    const response = await fetch(`${endpoint}/cli/auth/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cli_name: 'Agentics CLI',
        cli_version: '0.1.0',
        hostname: hostname(),
        scopes: ['platform:read', 'platform:write'],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json() as { error?: string };
      throw new Error(errorBody.error || 'Failed to create auth session');
    }

    session = await response.json() as CliAuthSessionResponse;
    initSpinner.succeed('Authentication session created');
  } catch (err) {
    initSpinner.fail('Failed to create authentication session');
    throw err;
  }

  // Validate the verification URL
  try {
    const verifyUrl = new URL(session.verification_url);

    // Warn if verification URL points to localhost (likely misconfigured server)
    if (verifyUrl.hostname === 'localhost' || verifyUrl.hostname === '127.0.0.1') {
      warning('Verification URL points to localhost - this may be a server misconfiguration.');
      warning('If you expected a production URL, check the PLATFORM_URL on the API server.');
    }

    // Warn if protocol doesn't match (security concern)
    if (verifyUrl.protocol === 'http:' && verifyUrl.hostname !== 'localhost' && verifyUrl.hostname !== '127.0.0.1') {
      warning('Verification URL uses insecure HTTP. This may be a misconfiguration.');
    }
  } catch {
    displayError('Server returned invalid verification URL');
    displayError(`Received: ${session.verification_url}`);
    process.exit(1);
  }

  // Display the verification URL with clear formatting
  console.log('');
  console.log('  To authenticate, visit:');
  console.log('');
  console.log(`  \x1b[1m\x1b[4m${session.verification_url}\x1b[0m`);
  console.log('');
  console.log(`  Session code: \x1b[1m${session.session_code}\x1b[0m`);
  console.log('');

  // Try to open browser automatically (unless --no-browser flag)
  if (!options.noBrowser) {
    const browserOpened = await openBrowser(session.verification_url);
    if (browserOpened) {
      info('Browser opened automatically');
    } else {
      warning('Could not open browser. Please visit the URL above manually.');
    }
  } else {
    info('Please visit the URL above to authenticate');
  }

  // Poll for completion
  const pollSpinner = spinner('Waiting for authentication...');
  const pollInterval = (session.poll_interval_seconds || 5) * 1000;
  const maxAttempts = Math.ceil((session.expires_in_seconds || 600) / (pollInterval / 1000));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);

    try {
      const response = await fetch(`${endpoint}/cli/auth/sessions/${session.device_code}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.json() as { error?: string; code?: string };

        if (errorBody.code === 'SESSION_EXPIRED') {
          pollSpinner.fail('Authentication session expired');
          displayError('Session expired. Please run `agentics login` again.');
          process.exit(1);
        }

        if (errorBody.code === 'SESSION_CANCELLED') {
          pollSpinner.fail('Authentication cancelled');
          displayError('You cancelled the authentication. Run `agentics login` to try again.');
          process.exit(1);
        }

        throw new Error(errorBody.error || 'Failed to check session status');
      }

      const pollResult = await response.json() as CliAuthPollResponse;

      if (pollResult.status === 'pending') {
        // Still waiting, continue polling
        continue;
      }

      if (pollResult.status === 'authorized') {
        pollSpinner.text = 'Generating API key...';
        continue;
      }

      if (pollResult.status === 'completed' && pollResult.api_key) {
        pollSpinner.succeed('Authentication successful');

        // Store the API key
        setApiKey(pollResult.api_key);

        // Verify and fetch identity
        const client = createClient();
        try {
          const identity = await client.whoami();
          setIdentity({
            user_id: identity.user_id,
            email: identity.email,
          });

          console.log('');
          success('Logged in successfully!');
          info(`Email: ${identity.email}`);
          info('API key has been saved to ~/.agentics/credentials.json');
          console.log('');
          info('You can now use Agentics CLI commands.');
        } catch (err) {
          // Key was saved but couldn't verify - still successful
          success('Logged in successfully!');
          warning('Could not verify identity. Your API key has been saved.');
        }

        return;
      }

      // If completed but no API key, it was already retrieved
      if (pollResult.status === 'completed') {
        pollSpinner.fail('API key already retrieved');
        displayError('This session was already completed. Please run `agentics login` again.');
        process.exit(1);
      }
    } catch (err) {
      // Network error, continue trying
      continue;
    }
  }

  // Timed out
  pollSpinner.fail('Authentication timed out');
  displayError('Session expired. Please run `agentics login` again.');
  process.exit(1);
}

/**
 * Login command handler
 */
async function loginHandler(options: {
  apiKey?: string;
  email?: string;
  password?: string;
  browser?: boolean;
  noBrowser?: boolean;
}): Promise<void> {
  try {
    const client = createClient();

    // If API key provided, just store it
    if (options.apiKey) {
      setApiKey(options.apiKey);
      success('API key saved successfully');

      // Verify by fetching identity
      const loadingSpinner = spinner('Verifying API key...');
      try {
        const identity = await client.whoami();
        loadingSpinner.succeed('API key verified');

        // Cache identity
        setIdentity({
          user_id: identity.user_id,
          email: identity.email,
        });

        info(`Logged in as: ${identity.email}`);
      } catch (err) {
        loadingSpinner.fail('Invalid API key');
        throw err;
      }
      return;
    }

    // If email/password provided or explicitly not browser mode, use traditional auth
    if (options.email || options.password || options.browser === false) {
      // Traditional email/password authentication
      const email = options.email || await prompt('Email: ');
      const password = options.password || await promptPassword('Password: ');

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const loadingSpinner = spinner('Authenticating...');

      const result = await client.authenticate({
        email,
        password,
      });

      loadingSpinner.succeed('Authentication successful');

      // Store the token as API key
      setApiKey(result.token);

      // Fetch and cache identity
      const identity = await client.whoami();
      setIdentity({
        user_id: identity.user_id,
        email: identity.email,
      });

      success('Logged in successfully');
      info(`Logged in as: ${identity.email}`);
      info(`Token expires at: ${result.expires_at}`);

      // Display scopes
      if (result.scopes && result.scopes.length > 0) {
        info(`Scopes: ${result.scopes.join(', ')}`);
      }
      return;
    }

    // Default: Browser-based authentication (recommended)
    await browserLoginHandler({ noBrowser: options.noBrowser });
  } catch (err) {
    handleError(err);
  }
}

/**
 * Create and configure the login command
 */
export function createLoginCommand(): Command {
  return new Command('login')
    .description('Authenticate with the Agentics Platform')
    .option('--api-key <key>', 'Use an existing API key')
    .option('--email <email>', 'Email address (for email/password auth)')
    .option('--password <password>', 'Password (not recommended, use browser auth instead)')
    .option('--no-browser', 'Do not open browser automatically')
    .addHelpText('after', `
Examples:
  $ agentics login                    # Browser-based auth (recommended)
  $ agentics login --no-browser       # Browser auth without auto-opening
  $ agentics login --api-key <key>    # Use existing API key
  $ agentics login --email me@co.com  # Email/password auth (legacy)

Authentication Methods:
  Browser (default):  Securely authenticate via your browser. An API key
                      bound to your account will be generated automatically.

  API Key:           If you already have an API key from the dashboard,
                      you can provide it directly with --api-key.

  Email/Password:    Legacy method. Prompts for credentials. Consider
                      using browser auth for better security.
`)
    .action(loginHandler);
}
