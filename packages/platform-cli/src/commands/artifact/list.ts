/**
 * artifact list command - list artifacts in context
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { forward } from '../../delegation/forwarder.js';
import { executeDryRun } from '../../delegation/dry-run.js';

export interface ArtifactListOptions {
  env?: string;
  type?: 'plan' | 'config' | 'manifest' | 'export';
  format?: 'json' | 'table';
  limit?: number;
}

/**
 * Execute artifact list command
 */
export async function artifactList(
  context: ExecutionContext,
  options: ArtifactListOptions = {}
): Promise<void> {
  if (context.dryRun) {
    executeDryRun('artifact list', [], context, [
      {
        action: 'Query',
        target: 'Platform API',
        details: {
          endpoint: '/v1/artifacts',
          orgId: context.org.orgId,
          envId: options.env ?? context.env.envId,
          type: options.type,
        },
      },
      {
        action: 'Display',
        target: 'Artifact list',
        details: {
          format: options.format ?? 'table',
          limit: options.limit ?? 20,
        },
      },
    ]);
    return;
  }

  // Delegate to agentics CLI
  const args = [
    'list',
    ...(options.env ? ['--env', options.env] : []),
    ...(options.type ? ['--type', options.type] : []),
    ...(options.format ? ['--format', options.format] : []),
    ...(options.limit ? ['--limit', options.limit.toString()] : []),
  ];

  await forward('artifact', args, context);
}

/**
 * Display artifacts in table format
 */
export function displayArtifactsTable(
  artifacts: Array<{
    id: string;
    type: string;
    createdAt: string;
    status: string;
  }>
): void {
  console.log(chalk.bold('\nArtifacts:\n'));
  console.log(chalk.gray('  ID                    Type        Created                   Status'));
  console.log(chalk.gray('  ─'.repeat(40)));

  for (const artifact of artifacts) {
    const statusColor =
      artifact.status === 'active' ? chalk.green :
      artifact.status === 'pending' ? chalk.yellow :
      chalk.gray;

    console.log(
      `  ${artifact.id.padEnd(22)} ${artifact.type.padEnd(12)} ${artifact.createdAt.padEnd(24)} ${statusColor(artifact.status)}`
    );
  }

  console.log();
}
