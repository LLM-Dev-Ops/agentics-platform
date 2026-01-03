/**
 * org current command - display current organization context
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { getStoredOrg } from '../../context/resolver.js';
import { getManifest } from '../../context/manifest.js';

export interface OrgCurrentOptions {
  format?: 'json' | 'table';
}

/**
 * Execute org current command
 */
export async function orgCurrent(
  context: ExecutionContext,
  options: OrgCurrentOptions = {}
): Promise<void> {
  const storedOrg = getStoredOrg();
  const manifest = await getManifest();
  const envOrg = process.env['AGENTICS_ORG'];

  // Determine active org and source
  let activeOrg: string | undefined;
  let source: string;

  if (context.org.orgId !== 'none') {
    activeOrg = context.org.orgId;
    source = 'resolved';
  } else if (envOrg) {
    activeOrg = envOrg;
    source = 'environment variable (AGENTICS_ORG)';
  } else if (manifest?.org) {
    activeOrg = manifest.org.id;
    source = 'project manifest (.agentics-manifest.json)';
  } else if (storedOrg) {
    activeOrg = storedOrg.orgId;
    source = 'stored configuration';
  } else {
    source = 'none';
  }

  if (options.format === 'json') {
    console.log(JSON.stringify({
      orgId: activeOrg ?? null,
      orgName: context.org.orgName ?? storedOrg?.orgName ?? null,
      tier: context.org.tier ?? storedOrg?.tier ?? null,
      source,
      environmentVariable: envOrg ?? null,
      manifestOrg: manifest?.org?.id ?? null,
      storedOrg: storedOrg?.orgId ?? null,
    }, null, 2));
    return;
  }

  // Table format
  console.log(chalk.bold('\nCurrent Organization Context:\n'));

  if (activeOrg) {
    console.log(`  ${chalk.cyan('Active Org:')}    ${chalk.bold(activeOrg)}`);
    console.log(`  ${chalk.cyan('Source:')}       ${source}`);

    if (context.org.orgName) {
      console.log(`  ${chalk.cyan('Name:')}         ${context.org.orgName}`);
    }
    if (context.org.tier) {
      console.log(`  ${chalk.cyan('Tier:')}         ${context.org.tier}`);
    }
  } else {
    console.log(chalk.yellow('  No organization context set.\n'));
    console.log(chalk.gray('  To set an organization:'));
    console.log(chalk.gray('    - Use --org flag'));
    console.log(chalk.gray('    - Set AGENTICS_ORG environment variable'));
    console.log(chalk.gray('    - Create .agentics-manifest.json'));
    console.log(chalk.gray('    - Run: agentics-platform org switch <org-id>'));
  }

  console.log();

  // Show all sources
  console.log(chalk.gray('  Resolution sources:'));
  console.log(chalk.gray(`    Environment: ${envOrg ?? '(not set)'}`));
  console.log(chalk.gray(`    Manifest:    ${manifest?.org?.id ?? '(not found)'}`));
  console.log(chalk.gray(`    Stored:      ${storedOrg?.orgId ?? '(not set)'}`));
  console.log();
}
