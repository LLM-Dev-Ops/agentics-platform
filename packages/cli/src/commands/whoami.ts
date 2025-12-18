/**
 * Whoami Command for Agentics CLI
 *
 * Displays current user identity and usage information
 */

import { Command } from 'commander';
import { createClient, handleError } from '../client.js';
import { getFormat } from '../config.js';
import { formatTable, formatJson, formatNumber, spinner } from '../output.js';
import type { OutputFormat } from '../output.js';

/**
 * Whoami command handler
 */
async function whoamiHandler(options: { format?: OutputFormat }): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Fetching identity...');

    const identity = await client.whoami();
    loadingSpinner.succeed('Identity retrieved');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(identity));
    } else {
      // Display as formatted table
      console.log('\nUser Identity:');
      console.log(formatTable(
        [
          { key: 'User ID', value: identity.user_id },
          { key: 'Email', value: identity.email },
          { key: 'Tier', value: identity.tier || 'N/A' },
          { key: 'Created', value: identity.created_at || 'N/A' },
        ],
        [
          { header: 'Property', key: 'key' },
          { header: 'Value', key: 'value' },
        ]
      ));

      console.log('\nScopes:');
      if (identity.scopes && identity.scopes.length > 0) {
        identity.scopes.forEach((scope: string) => {
          console.log(`  - ${scope}`);
        });
      } else {
        console.log('  No scopes available');
      }

      console.log('\nCurrent Usage:');
      console.log(formatTable(
        [
          {
            metric: 'Requests',
            value: formatNumber(identity.usage.requests),
          },
          {
            metric: 'Tokens',
            value: formatNumber(identity.usage.tokens),
          },
          {
            metric: 'Compute Seconds',
            value: formatNumber(identity.usage.compute_seconds),
          },
        ],
        [
          { header: 'Metric', key: 'metric' },
          { header: 'Value', key: 'value' },
        ]
      ));
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Create and configure the whoami command
 */
export function createWhoamiCommand(): Command {
  return new Command('whoami')
    .description('Display current user identity and usage information')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(whoamiHandler);
}
