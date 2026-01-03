/**
 * env current command - display current environment context
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { getStoredEnv } from '../../context/resolver.js';
import { getManifest } from '../../context/manifest.js';

export interface EnvCurrentOptions {
  format?: 'json' | 'table';
}

/**
 * Execute env current command
 */
export async function envCurrent(
  context: ExecutionContext,
  options: EnvCurrentOptions = {}
): Promise<void> {
  const storedEnv = getStoredEnv();
  const manifest = await getManifest();
  const envEnv = process.env['AGENTICS_ENV'];

  // Determine active env and source
  let activeEnv: string | undefined;
  let source: string;

  if (context.env.envId !== 'none') {
    activeEnv = context.env.envId;
    source = 'resolved';
  } else if (envEnv) {
    activeEnv = envEnv;
    source = 'environment variable (AGENTICS_ENV)';
  } else if (manifest?.env) {
    activeEnv = manifest.env.id;
    source = 'project manifest (.agentics-manifest.json)';
  } else if (storedEnv) {
    activeEnv = storedEnv.envId;
    source = 'stored configuration';
  } else {
    source = 'none';
  }

  if (options.format === 'json') {
    console.log(JSON.stringify({
      envId: activeEnv ?? null,
      envName: context.env.envName ?? storedEnv?.envName ?? null,
      envType: context.env.envType ?? storedEnv?.envType ?? null,
      source,
      environmentVariable: envEnv ?? null,
      manifestEnv: manifest?.env?.id ?? null,
      storedEnv: storedEnv?.envId ?? null,
    }, null, 2));
    return;
  }

  // Table format
  console.log(chalk.bold('\nCurrent Environment Context:\n'));

  if (activeEnv) {
    console.log(`  ${chalk.cyan('Active Env:')}    ${chalk.bold(activeEnv)}`);
    console.log(`  ${chalk.cyan('Source:')}       ${source}`);

    if (context.env.envName) {
      console.log(`  ${chalk.cyan('Name:')}         ${context.env.envName}`);
    }
    if (context.env.envType) {
      const typeColor =
        context.env.envType === 'production' ? chalk.red :
        context.env.envType === 'staging' ? chalk.yellow :
        chalk.green;
      console.log(`  ${chalk.cyan('Type:')}         ${typeColor(context.env.envType)}`);
    }
  } else {
    console.log(chalk.yellow('  No environment context set.\n'));
    console.log(chalk.gray('  To set an environment:'));
    console.log(chalk.gray('    - Use --env flag'));
    console.log(chalk.gray('    - Set AGENTICS_ENV environment variable'));
    console.log(chalk.gray('    - Create .agentics-manifest.json'));
    console.log(chalk.gray('    - Run: agentics-platform env switch <env-id>'));
  }

  console.log();

  // Show all sources
  console.log(chalk.gray('  Resolution sources:'));
  console.log(chalk.gray(`    Environment: ${envEnv ?? '(not set)'}`));
  console.log(chalk.gray(`    Manifest:    ${manifest?.env?.id ?? '(not found)'}`));
  console.log(chalk.gray(`    Stored:      ${storedEnv?.envId ?? '(not set)'}`));
  console.log();
}
