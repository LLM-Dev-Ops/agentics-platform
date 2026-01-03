/**
 * arch validate command - validate path against architecture rules
 *
 * READ-ONLY: Validates against loaded rules, does not modify anything
 */

import chalk from 'chalk';
import type { ExecutionContext } from '../../types/context.js';
import { validatePath } from '../../policy/index.js';

export interface ArchValidateOptions {
  format?: 'json' | 'table';
  strict?: boolean;
}

/**
 * Execute arch validate command
 */
export async function archValidate(
  path: string,
  _context: ExecutionContext,
  options: ArchValidateOptions = {}
): Promise<void> {
  if (!path) {
    console.error(chalk.red('Error: Path argument is required'));
    process.exit(1);
  }

  console.log(chalk.gray(`\nValidating: ${path}\n`));

  // Load policies and validate
  const result = await validatePath(path);

  if (options.format === 'json') {
    console.log(JSON.stringify({
      path,
      valid: result.valid,
      violations: result.violations,
      checkedPolicies: result.checkedPolicies,
    }, null, 2));

    if (!result.valid && options.strict) {
      process.exit(1);
    }
    return;
  }

  // Table format output
  console.log(chalk.gray('  Checked policies:'));
  for (const policy of result.checkedPolicies) {
    console.log(chalk.gray(`    - ${policy}`));
  }
  console.log();

  if (result.valid) {
    console.log(chalk.green.bold('  ✓ Path complies with architecture constraints\n'));
  } else {
    console.log(chalk.red.bold(`  ✗ Found ${result.violations.length} violation(s):\n`));

    for (let i = 0; i < result.violations.length; i++) {
      const v = result.violations[i];
      if (!v) continue;

      const severityColor =
        v.severity === 'critical' ? chalk.red :
        v.severity === 'high' ? chalk.yellow :
        chalk.gray;

      console.log(`  ${i + 1}. ${severityColor(`[${v.severity.toUpperCase()}]`)} ${v.ruleId}`);
      console.log(chalk.gray(`     ${v.description}`));
      console.log(chalk.gray(`     Source: ${v.sourceDoc}`));
      console.log();
    }

    if (options.strict) {
      process.exit(1);
    }
  }
}

/**
 * Display validation summary
 */
export function displayValidationSummary(
  checkedPaths: string[],
  violationCount: number
): void {
  console.log(chalk.bold('\nValidation Summary:\n'));
  console.log(`  ${chalk.cyan('Paths checked:')} ${checkedPaths.length}`);
  console.log(`  ${chalk.cyan('Violations:')}    ${violationCount === 0 ? chalk.green('0') : chalk.red(violationCount.toString())}`);
  console.log();
}
