/**
 * intent reject command - reject a pending intent
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { forward } from '../../delegation/forwarder.js';
import { executeDryRun } from '../../delegation/dry-run.js';

export interface IntentRejectOptions {
  reason: string;
}

/**
 * Execute intent reject command
 */
export async function intentReject(
  intentId: string,
  context: ExecutionContext,
  options: IntentRejectOptions
): Promise<void> {
  if (!intentId) {
    console.error(chalk.red('Error: Intent ID is required'));
    process.exit(1);
  }

  if (!options.reason) {
    console.error(chalk.red('Error: Rejection reason is required (--reason)'));
    process.exit(1);
  }

  if (context.dryRun) {
    executeDryRun('intent reject', [intentId], context, [
      {
        action: 'Fetch',
        target: 'Intent',
        details: { intentId },
      },
      {
        action: 'Validate',
        target: 'Rejection permissions',
        details: { orgId: context.org.orgId },
      },
      {
        action: 'Transition',
        target: 'Intent state',
        details: { from: 'pending', to: 'rejected', reason: options.reason },
      },
      {
        action: 'Notify',
        target: 'Stakeholders',
        details: { event: 'intent_rejected' },
      },
    ]);
    return;
  }

  await forward('intent', ['reject', intentId, '--reason', options.reason], context);
}
