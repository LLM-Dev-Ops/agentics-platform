/**
 * intent approve command - approve a pending intent
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { forward } from '../../delegation/forwarder.js';
import { executeDryRun } from '../../delegation/dry-run.js';

/**
 * Execute intent approve command
 */
export async function intentApprove(
  intentId: string,
  context: ExecutionContext
): Promise<void> {
  if (!intentId) {
    console.error(chalk.red('Error: Intent ID is required'));
    process.exit(1);
  }

  if (context.dryRun) {
    executeDryRun('intent approve', [intentId], context, [
      {
        action: 'Fetch',
        target: 'Intent',
        details: { intentId },
      },
      {
        action: 'Validate',
        target: 'Approval permissions',
        details: { orgId: context.org.orgId },
      },
      {
        action: 'Transition',
        target: 'Intent state',
        details: { from: 'pending', to: 'approved' },
      },
      {
        action: 'Notify',
        target: 'Stakeholders',
        details: { event: 'intent_approved' },
      },
    ]);
    return;
  }

  await forward('intent', ['approve', intentId], context);
}
