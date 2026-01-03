/**
 * intent submit command - submit a new governance intent
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import type { IntentSubmission, IntentType } from '../../types/lifecycle.js';
import { forward } from '../../delegation/forwarder.js';
import { executeDryRun } from '../../delegation/dry-run.js';

export interface IntentSubmitOptions {
  type: IntentType;
  target: string;
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
}

/**
 * Execute intent submit command
 */
export async function intentSubmit(
  context: ExecutionContext,
  options: IntentSubmitOptions
): Promise<void> {
  const submission: IntentSubmission = {
    type: options.type,
    target: options.target,
    metadata: options.metadata,
  };

  if (context.dryRun) {
    executeDryRun('intent submit', [], context, [
      {
        action: 'Validate',
        target: 'Intent submission',
        details: { ...submission } as Record<string, unknown>,
      },
      {
        action: 'Check',
        target: 'Governance policies',
        details: { orgId: context.org.orgId },
      },
      {
        action: 'Create',
        target: 'Intent record',
        details: {
          type: options.type,
          state: 'pending',
        },
      },
      {
        action: 'Notify',
        target: 'Approval workflow',
        details: { envId: context.env.envId },
      },
    ]);
    return;
  }

  // Validate required fields
  if (!options.type) {
    console.error(chalk.red('Error: Intent type is required (--type)'));
    process.exit(1);
  }
  if (!options.target) {
    console.error(chalk.red('Error: Intent target is required (--target)'));
    process.exit(1);
  }

  // Delegate to agentics CLI
  const args = [
    'submit',
    '--type', options.type,
    '--target', options.target,
    ...(options.metadata ? ['--metadata', JSON.stringify(options.metadata)] : []),
  ];

  await forward('intent', args, context);
}
