/**
 * env switch command - switch to a different environment
 */

import chalk from 'chalk';
import type { ExecutionContext, EnvContext } from '../../types/context.js';
import { storeEnvContext } from '../../context/resolver.js';
import { executeDryRun } from '../../delegation/dry-run.js';

/**
 * Execute env switch command
 */
export async function envSwitch(
  envId: string,
  context: ExecutionContext
): Promise<void> {
  if (context.dryRun) {
    executeDryRun('env switch', [envId], context, [
      {
        action: 'Validate',
        target: 'Environment ID',
        details: { envId },
      },
      {
        action: 'Update',
        target: 'Stored configuration',
        details: { field: 'currentEnv', value: envId },
      },
    ]);
    return;
  }

  // Validate env ID format (basic validation)
  if (!envId || envId.length < 3) {
    console.error(chalk.red('Error: Invalid environment ID'));
    process.exit(1);
  }

  // Store the new env context
  const newEnv: EnvContext = {
    envId,
    envType: 'development', // Default, would be resolved from API in full implementation
  };

  storeEnvContext(newEnv);

  console.log(chalk.green(`\nSwitched to environment: ${chalk.bold(envId)}\n`));
  console.log(chalk.gray('This environment will be used for all subsequent commands.'));
  console.log(chalk.gray('Use --env flag to override for individual commands.\n'));
}
