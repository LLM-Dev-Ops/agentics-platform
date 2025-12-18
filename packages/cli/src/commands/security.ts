/**
 * Security Command for Agentics CLI
 *
 * Security scanning and vulnerability detection operations
 */

import { Command } from 'commander';
import { createClient, handleError } from '../client.js';
import { getFormat } from '../config.js';
import { formatJson, spinner, success, info } from '../output.js';
import type { OutputFormat } from '../output.js';

/**
 * Security scan command handler
 */
async function scanHandler(options: {
  target?: string;
  type?: string;
  output?: string;
  format?: OutputFormat;
}): Promise<void> {
  try {
    const client = createClient();

    if (!options.target) {
      throw new Error('--target is required');
    }

    const loadingSpinner = spinner('Starting security scan...');

    const result = await client.securityScan({
      target: options.target,
      type: options.type,
    });

    loadingSpinner.succeed('Scan started');

    success(`Scan ID: ${result.scan_id}`);
    info(`Status: ${result.status}`);

    info('\nTo check results, run:');
    info(`  agentics security results ${result.scan_id}`);

    if (options.output) {
      // Save scan ID to file
      const fs = await import('fs/promises');
      await fs.writeFile(
        options.output,
        JSON.stringify(result, null, 2),
        'utf-8'
      );
      info(`Scan info saved to: ${options.output}`);
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Security scan results command handler
 */
async function resultsHandler(
  scanId: string,
  options: { format?: OutputFormat }
): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Fetching scan results...');

    const results = await client.getSecurityScan(scanId);
    loadingSpinner.succeed('Results retrieved');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(results));
    } else {
      // Display formatted results
      console.log('\nSecurity Scan Results:');
      console.log(formatJson(results));
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Create and configure the security command
 */
export function createSecurityCommand(): Command {
  const cmd = new Command('security')
    .description('Security scanning and vulnerability detection');

  // Scan subcommand
  cmd
    .command('scan')
    .description('Run a security scan')
    .option('--target <target>', 'Target to scan (URL, repository, etc.)')
    .option('--type <type>', 'Scan type (vulnerability, compliance, etc.)')
    .option('--output <path>', 'Save scan info to file')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(scanHandler);

  // Results subcommand
  cmd
    .command('results <scan-id>')
    .description('Get security scan results')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(resultsHandler);

  return cmd;
}
