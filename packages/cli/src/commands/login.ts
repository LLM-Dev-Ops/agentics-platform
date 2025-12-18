/**
 * Login Command for Agentics CLI
 *
 * Authenticates the user and stores credentials
 */

import { Command } from 'commander';
import { createClient, handleError } from '../client.js';
import { setApiKey, setIdentity } from '../config.js';
import { success, spinner, info } from '../output.js';

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
 * Login command handler
 */
async function loginHandler(options: {
  apiKey?: string;
  email?: string;
  password?: string;
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

    // Otherwise, prompt for email/password
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
    .option('--api-key <key>', 'API key for authentication')
    .option('--email <email>', 'Email address')
    .option('--password <password>', 'Password (not recommended for security)')
    .action(loginHandler);
}
