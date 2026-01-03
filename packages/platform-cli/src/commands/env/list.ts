/**
 * env list command - list available environments
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { forward } from '../../delegation/forwarder.js';
import { executeDryRun } from '../../delegation/dry-run.js';

export interface EnvListOptions {
  org?: string;
  format?: 'json' | 'table';
}

/**
 * Execute env list command
 */
export async function envList(
  context: ExecutionContext,
  options: EnvListOptions = {}
): Promise<void> {
  const args: string[] = ['env', 'list'];

  if (options.org) {
    args.push('--org', options.org);
  }

  if (options.format) {
    args.push('--format', options.format);
  }

  if (context.dryRun) {
    executeDryRun('env list', args, context, [
      {
        action: 'Query',
        target: 'Platform API',
        details: {
          endpoint: '/v1/environments',
          orgId: options.org ?? context.org.orgId,
        },
      },
      {
        action: 'Display',
        target: 'Environment list',
        details: { format: options.format ?? 'table' },
      },
    ]);
    return;
  }

  // Delegate to agentics CLI
  await forward('env', [
    'list',
    ...(options.org ? ['--org', options.org] : []),
    ...(options.format ? ['--format', options.format] : []),
  ], context);
}

/**
 * Display environments in table format
 */
export function displayEnvsTable(
  envs: Array<{ id: string; name: string; type: string; status?: string }>
): void {
  console.log(chalk.bold('\nEnvironments:\n'));
  console.log(chalk.gray('  ID                                    Name                 Type        Status'));
  console.log(chalk.gray('  ─'.repeat(40)));

  for (const env of envs) {
    const typeColor =
      env.type === 'production' ? chalk.red :
      env.type === 'staging' ? chalk.yellow :
      chalk.green;

    const status = env.status ?? 'active';
    const statusColor = status === 'active' ? chalk.green : chalk.gray;

    console.log(
      `  ${env.id}  ${env.name.padEnd(20)} ${typeColor(env.type.padEnd(12))} ${statusColor(status)}`
    );
  }

  console.log();
}
