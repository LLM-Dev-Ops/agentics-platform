/**
 * intent list command - list intents
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import type { IntentState } from '../../types/lifecycle.js';
import { forward } from '../../delegation/forwarder.js';

export interface IntentListOptions {
  status?: IntentState;
  format?: 'json' | 'table';
  limit?: number;
}

/**
 * Execute intent list command
 */
export async function intentList(
  context: ExecutionContext,
  options: IntentListOptions = {}
): Promise<void> {
  const args = [
    'list',
    ...(options.status ? ['--status', options.status] : []),
    ...(options.format ? ['--format', options.format] : []),
    ...(options.limit ? ['--limit', options.limit.toString()] : []),
  ];

  await forward('intent', args, context);
}

/**
 * Display intents in table format
 */
export function displayIntentsTable(
  intents: Array<{
    id: string;
    type: string;
    state: IntentState;
    target: string;
    submittedAt: string;
  }>
): void {
  console.log(chalk.bold('\nIntents:\n'));
  console.log(chalk.gray('  ID                    Type          State       Target              Submitted'));
  console.log(chalk.gray('  ' + '\u2500'.repeat(90)));

  for (const intent of intents) {
    const stateColor =
      intent.state === 'approved' ? chalk.green :
      intent.state === 'rejected' ? chalk.red :
      intent.state === 'pending' ? chalk.yellow :
      chalk.gray;

    console.log(
      `  ${intent.id.slice(0, 20).padEnd(22)} ${intent.type.padEnd(14)} ${stateColor(intent.state.padEnd(12))} ${intent.target.slice(0, 18).padEnd(20)} ${intent.submittedAt}`
    );
  }

  console.log();
}
