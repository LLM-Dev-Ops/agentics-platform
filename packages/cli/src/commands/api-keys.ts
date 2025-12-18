/**
 * API Keys Command for Agentics CLI
 *
 * API key management operations
 */

import { Command } from 'commander';
import { createClient, handleError } from '../client.js';
import { getFormat } from '../config.js';
import { formatJson, formatTable, spinner, success, info, warning } from '../output.js';
import type { OutputFormat } from '../output.js';
import { Scope } from '@agentics/shared';

/**
 * API keys list command handler
 */
async function listHandler(options: { format?: OutputFormat }): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Fetching API keys...');

    const keys = await client.listApiKeys();
    loadingSpinner.succeed('API keys retrieved');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(keys));
    } else {
      if (keys.length === 0) {
        info('No API keys found');
        return;
      }

      console.log(formatTable(
        keys.map((key) => ({
          id: key.id,
          name: key.name,
          preview: key.key_preview || 'N/A',
          scopes: key.scopes.join(', '),
          created: new Date(key.created_at).toLocaleDateString(),
          expires: key.expires_at
            ? new Date(key.expires_at).toLocaleDateString()
            : 'Never',
          status: key.revoked ? 'Revoked' : 'Active',
        })),
        [
          { header: 'ID', key: 'id', width: 20 },
          { header: 'Name', key: 'name', width: 20 },
          { header: 'Preview', key: 'preview', width: 10 },
          { header: 'Scopes', key: 'scopes', width: 30 },
          { header: 'Created', key: 'created', width: 12 },
          { header: 'Expires', key: 'expires', width: 12 },
          { header: 'Status', key: 'status', width: 10 },
        ]
      ));
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * API keys create command handler
 */
async function createHandler(options: {
  name?: string;
  scopes?: string;
  expires?: string;
  format?: OutputFormat;
}): Promise<void> {
  try {
    const client = createClient();

    if (!options.name) {
      throw new Error('--name is required');
    }

    const scopes = options.scopes
      ? (options.scopes.split(',').map((s) => s.trim()) as Scope[])
      : [
          'identity:read' as Scope,
          'intelligence:read' as Scope,
          'simulation:read' as Scope,
        ];

    const loadingSpinner = spinner('Creating API key...');

    const result = await client.createApiKey({
      name: options.name,
      scopes,
      expires_at: options.expires,
    });

    loadingSpinner.succeed('API key created');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(result));
    } else {
      success('API key created successfully');
      console.log('');
      warning('IMPORTANT: Save this key now. It will not be shown again!');
      console.log('');
      console.log(`API Key: ${result.key}`);
      console.log('');
      info(`Key ID: ${result.api_key.id}`);
      info(`Name: ${result.api_key.name}`);
      info(`Scopes: ${result.api_key.scopes.join(', ')}`);
      if (result.api_key.expires_at) {
        info(`Expires: ${result.api_key.expires_at}`);
      }
      console.log('');
      info('To use this key, set the AGENTICS_API_KEY environment variable:');
      console.log(`  export AGENTICS_API_KEY="${result.key}"`);
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * API keys revoke command handler
 */
async function revokeHandler(
  keyId: string
): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Revoking API key...');

    await client.revokeApiKey(keyId);
    loadingSpinner.succeed('API key revoked');

    success(`API key ${keyId} has been revoked`);
  } catch (err) {
    handleError(err);
  }
}

/**
 * Create and configure the api-keys command
 */
export function createApiKeysCommand(): Command {
  const cmd = new Command('api-keys')
    .description('Manage API keys for programmatic access');

  cmd
    .command('list')
    .description('List all API keys')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(listHandler);

  cmd
    .command('create')
    .description('Create a new API key')
    .option('--name <name>', 'API key name (required)')
    .option('--scopes <scopes>', 'Comma-separated list of scopes')
    .option('--expires <date>', 'Expiration date (ISO 8601 format)')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(createHandler);

  cmd
    .command('revoke <key-id>')
    .description('Revoke an API key')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(revokeHandler);

  return cmd;
}
