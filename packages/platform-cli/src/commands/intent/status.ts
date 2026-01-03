/**
 * intent status command - check intent status
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import type { IntentState } from '../../types/lifecycle.js';
import { forward } from '../../delegation/forwarder.js';

export interface IntentStatusOptions {
  format?: 'json' | 'table';
}

/**
 * Execute intent status command
 */
export async function intentStatus(
  intentId: string,
  context: ExecutionContext,
  options: IntentStatusOptions = {}
): Promise<void> {
  if (!intentId) {
    console.error(chalk.red('Error: Intent ID is required'));
    process.exit(1);
  }

  const args = [
    'status', intentId,
    ...(options.format ? ['--format', options.format] : []),
  ];

  await forward('intent', args, context);
}

/**
 * Display intent status in table format
 */
export function displayIntentStatus(intent: {
  id: string;
  type: string;
  state: IntentState;
  submittedBy: string;
  submittedAt: string;
  target: string;
}): void {
  const stateColor =
    intent.state === 'approved' ? chalk.green :
    intent.state === 'rejected' ? chalk.red :
    intent.state === 'pending' ? chalk.yellow :
    intent.state === 'executing' ? chalk.cyan :
    chalk.gray;

  console.log(chalk.bold('\nIntent Status:\n'));
  console.log(`  ${chalk.cyan('ID:')}          ${intent.id}`);
  console.log(`  ${chalk.cyan('Type:')}        ${intent.type}`);
  console.log(`  ${chalk.cyan('State:')}       ${stateColor(intent.state)}`);
  console.log(`  ${chalk.cyan('Target:')}      ${intent.target}`);
  console.log(`  ${chalk.cyan('Submitted By:')} ${intent.submittedBy}`);
  console.log(`  ${chalk.cyan('Submitted At:')} ${intent.submittedAt}`);
  console.log();
}
