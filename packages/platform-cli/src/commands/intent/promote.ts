/**
 * intent promote command - promote artifacts between environments
 *
 * IMPORTANT: This command was moved from 'env promote' to 'intent promote'
 * because promotion is part of intent lifecycle, not environment management.
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { forward } from '../../delegation/forwarder.js';
import { executeDryRun } from '../../delegation/dry-run.js';

export interface IntentPromoteOptions {
  artifactIds?: string[];
  dryRun?: boolean;
}

/**
 * Execute intent promote command
 */
export async function intentPromote(
  sourceEnv: string,
  targetEnv: string,
  context: ExecutionContext,
  options: IntentPromoteOptions = {}
): Promise<void> {
  // Validate environments
  if (!sourceEnv) {
    console.error(chalk.red('Error: Source environment is required'));
    process.exit(1);
  }
  if (!targetEnv) {
    console.error(chalk.red('Error: Target environment is required'));
    process.exit(1);
  }

  // Check for forbidden promotion paths (e.g., production -> development)
  const envHierarchy: Record<string, number> = {
    'development': 1,
    'staging': 2,
    'production': 3,
  };

  const sourceLevel = envHierarchy[sourceEnv] ?? 0;
  const targetLevel = envHierarchy[targetEnv] ?? 0;

  if (sourceLevel > targetLevel && targetLevel > 0) {
    console.error(chalk.red(`\nError: Cannot promote from ${sourceEnv} to ${targetEnv}`));
    console.error(chalk.yellow('Promotions must flow from lower to higher environments.'));
    console.error(chalk.gray('Valid promotion paths: development -> staging -> production\n'));
    process.exit(1);
  }

  if (context.dryRun) {
    executeDryRun('intent promote', [sourceEnv, targetEnv], context, [
      {
        action: 'Validate',
        target: 'Promotion path',
        details: { source: sourceEnv, target: targetEnv },
      },
      {
        action: 'Fetch',
        target: 'Promotable artifacts',
        details: {
          sourceEnv,
          artifactIds: options.artifactIds ?? 'all eligible',
        },
      },
      {
        action: 'Validate',
        target: 'Policy compliance',
        details: { targetEnv },
      },
      {
        action: 'Create',
        target: 'Promotion intent',
        details: {
          type: 'promotion',
          state: 'pending',
        },
      },
      {
        action: 'Stage',
        target: 'Artifacts for promotion',
        details: { targetEnv },
      },
    ]);
    return;
  }

  // Delegate to agentics CLI
  const args = [
    'promote', sourceEnv, targetEnv,
    ...(options.artifactIds ? ['--artifacts', options.artifactIds.join(',')] : []),
  ];

  await forward('intent', args, context);
}
