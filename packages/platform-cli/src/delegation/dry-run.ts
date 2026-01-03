/**
 * Dry-run wrapper for command delegation
 *
 * When --dry-run is specified, this module intercepts the command
 * and displays what would happen without actually executing.
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../types/context.js';
import { DryRunResult } from '../errors.js';

/** Dry-run action description */
export interface DryRunAction {
  action: string;
  target: string;
  details?: Record<string, unknown>;
}

/**
 * Generate dry-run output for a command
 */
export function generateDryRunOutput(
  _command: string,
  _args: string[],
  _context: ExecutionContext,
  plannedActions: DryRunAction[]
): DryRunResult {
  const actionDescriptions = plannedActions.map(a =>
    `${a.action}: ${a.target}${a.details ? ` (${JSON.stringify(a.details)})` : ''}`
  );

  const affectedResources = plannedActions.map(a => a.target);

  return new DryRunResult(actionDescriptions, affectedResources);
}

/**
 * Display dry-run header
 */
export function displayDryRunHeader(context: ExecutionContext): void {
  console.log(chalk.yellow.bold('\n╔══════════════════════════════════════╗'));
  console.log(chalk.yellow.bold('║           DRY RUN MODE               ║'));
  console.log(chalk.yellow.bold('╚══════════════════════════════════════╝\n'));

  console.log(chalk.gray('No changes will be made. Showing planned actions.\n'));
  console.log(chalk.gray(`Organization: ${context.org.orgId}`));
  console.log(chalk.gray(`Environment:  ${context.env.envId}`));
  console.log(chalk.gray(`Correlation:  ${context.correlationId}\n`));
}

/**
 * Display dry-run actions
 */
export function displayDryRunActions(actions: DryRunAction[]): void {
  console.log(chalk.cyan.bold('Planned Actions:\n'));

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (!action) continue;

    console.log(chalk.white(`  ${i + 1}. ${chalk.bold(action.action)}`));
    console.log(chalk.gray(`     Target: ${action.target}`));

    if (action.details) {
      console.log(chalk.gray(`     Details: ${JSON.stringify(action.details, null, 2)}`));
    }
    console.log();
  }
}

/**
 * Display dry-run summary
 */
export function displayDryRunSummary(actions: DryRunAction[]): void {
  console.log(chalk.yellow.bold('─'.repeat(40)));
  console.log(chalk.yellow(`\nTotal actions: ${actions.length}`));
  console.log(chalk.yellow('To execute these actions, remove the --dry-run flag.\n'));
}

/**
 * Execute dry-run workflow
 */
export function executeDryRun(
  _command: string,
  _args: string[],
  context: ExecutionContext,
  plannedActions: DryRunAction[]
): void {
  displayDryRunHeader(context);
  displayDryRunActions(plannedActions);
  displayDryRunSummary(plannedActions);
}

/**
 * Check if dry-run mode is active
 */
export function isDryRunMode(context: ExecutionContext): boolean {
  return context.dryRun;
}
