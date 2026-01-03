/**
 * org list command - list available organizations
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { forward } from '../../delegation/forwarder.js';
import { executeDryRun } from '../../delegation/dry-run.js';

export interface OrgListOptions {
  format?: 'json' | 'table';
}

/**
 * Execute org list command
 */
export async function orgList(
  context: ExecutionContext,
  options: OrgListOptions = {}
): Promise<void> {
  const args: string[] = ['org', 'list'];

  if (options.format) {
    args.push('--format', options.format);
  }

  if (context.dryRun) {
    executeDryRun('org list', args, context, [
      {
        action: 'Query',
        target: 'Platform API',
        details: { endpoint: '/v1/orgs' },
      },
      {
        action: 'Display',
        target: 'Organization list',
        details: { format: options.format ?? 'table' },
      },
    ]);
    return;
  }

  // Delegate to agentics CLI
  await forward('org', ['list', ...(options.format ? ['--format', options.format] : [])], context);
}

/**
 * Display organizations in table format
 */
export function displayOrgsTable(orgs: Array<{ id: string; name: string; tier?: string }>): void {
  console.log(chalk.bold('\nOrganizations:\n'));
  console.log(chalk.gray('  ID                                    Name                 Tier'));
  console.log(chalk.gray('  ─'.repeat(35)));

  for (const org of orgs) {
    const tier = org.tier ?? 'free';
    const tierColor = tier === 'enterprise' ? chalk.magenta : tier === 'pro' ? chalk.cyan : chalk.gray;
    console.log(`  ${org.id}  ${org.name.padEnd(20)} ${tierColor(tier)}`);
  }

  console.log();
}
