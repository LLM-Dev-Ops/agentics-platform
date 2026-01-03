/**
 * org switch command - switch to a different organization
 */

import chalk from 'chalk';
import type { ExecutionContext, OrgContext } from '../../types/context.js';
import { storeOrgContext } from '../../context/resolver.js';
import { executeDryRun } from '../../delegation/dry-run.js';

/**
 * Execute org switch command
 */
export async function orgSwitch(
  orgId: string,
  context: ExecutionContext
): Promise<void> {
  if (context.dryRun) {
    executeDryRun('org switch', [orgId], context, [
      {
        action: 'Validate',
        target: 'Organization ID',
        details: { orgId },
      },
      {
        action: 'Update',
        target: 'Stored configuration',
        details: { field: 'currentOrg', value: orgId },
      },
    ]);
    return;
  }

  // Validate org ID format (basic validation)
  if (!orgId || orgId.length < 3) {
    console.error(chalk.red('Error: Invalid organization ID'));
    process.exit(1);
  }

  // Store the new org context
  const newOrg: OrgContext = {
    orgId,
  };

  storeOrgContext(newOrg);

  console.log(chalk.green(`\nSwitched to organization: ${chalk.bold(orgId)}\n`));
  console.log(chalk.gray('This organization will be used for all subsequent commands.'));
  console.log(chalk.gray('Use --org flag to override for individual commands.\n'));
}
