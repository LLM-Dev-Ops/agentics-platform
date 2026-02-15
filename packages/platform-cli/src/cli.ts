#!/usr/bin/env node
/**
 * agentics-platform CLI binary
 *
 * This is a thin wrapper around the library. All logic is in the library
 * modules; this file only handles CLI argument parsing and command routing.
 */

import { Command } from 'commander';
import chalk from 'chalk';

// Import handlers
import { resolveContext } from './context/index.js';
import { orgList, orgSwitch, orgCurrent } from './commands/org/index.js';
import { envList, envSwitch, envCurrent } from './commands/env/index.js';
import { artifactPlan, artifactInspect, artifactDiff, artifactList } from './commands/artifact/index.js';
import { intentSubmit, intentStatus, intentApprove, intentReject, intentList, intentPromote } from './commands/intent/index.js';
import { archLayers, archBoundaries, archRepos, archValidate } from './commands/architecture/index.js';
import { erpDomains, erpEvents, erpReferences } from './commands/erp/index.js';
import { formatError, getExitCode, PlatformCliError, ConfirmationRequiredError } from './errors.js';
import { VERSION, CLI_NAME } from './index.js';
import type { CliFlags } from './context/types.js';
import type { ExecutionContext } from './types/context.js';

const program = new Command();

// Global error handler
function handleError(error: unknown): never {
  // Confirmation-required gets structured JSON output (HTTP 409 equivalent)
  if (error instanceof ConfirmationRequiredError) {
    const payload = {
      error: 'confirmation_required',
      reason: 'confirmation_required',
      command: error.commandPath,
      risk_level: error.riskLevel,
      message: error.message,
    };
    if (process.stdout.isTTY) {
      console.error(chalk.yellow(formatError(error)));
    } else {
      process.stdout.write(JSON.stringify(payload) + '\n');
    }
    process.exit(getExitCode(error));
  }

  if (error instanceof PlatformCliError) {
    console.error(chalk.red(formatError(error)));
    process.exit(getExitCode(error));
  }

  if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (process.env['DEBUG']) {
      console.error(error.stack);
    }
  } else {
    console.error(chalk.red('An unexpected error occurred'));
  }

  process.exit(1);
}

// Helper to get context with minimal requirements
async function getContext(options: Record<string, unknown>): Promise<ExecutionContext> {
  const flags: CliFlags = {
    org: options['org'] as string | undefined,
    env: options['env'] as string | undefined,
    dryRun: options['dryRun'] as boolean | undefined,
    confirmed: options['confirmed'] as boolean | undefined,
    format: options['format'] as 'json' | 'table' | undefined,
  };

  const resolved = await resolveContext(flags);
  return resolved.context;
}

// Helper for minimal context (doesn't require org/env)
function getMinimalContext(options: Record<string, unknown>): ExecutionContext {
  return {
    org: { orgId: options['org'] as string ?? 'none' },
    env: { envId: options['env'] as string ?? 'none', envType: 'development' },
    correlationId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    dryRun: options['dryRun'] as boolean ?? false,
    confirmed: options['confirmed'] as boolean ?? false,
  };
}

// Program setup
program
  .name(CLI_NAME)
  .description('Apex orchestration and governance CLI for the Agentics platform')
  .version(VERSION)
  .option('--org <org-id>', 'Override organization context')
  .option('--env <env-id>', 'Override environment context')
  .option('--dry-run', 'Show what would happen without executing')
  .option('--confirmed', 'Confirm execution of high-risk commands')
  .option('--format <format>', 'Output format (json|table)', 'table');

// ============ ORG COMMANDS ============
const orgCmd = program.command('org').description('Organization context management');

orgCmd
  .command('list')
  .description('List available organizations')
  .option('--format <format>', 'Output format (json|table)')
  .action(async (options) => {
    try {
      const context = getMinimalContext({ ...program.opts(), ...options });
      await orgList(context, { format: options.format });
    } catch (error) {
      handleError(error);
    }
  });

orgCmd
  .command('switch <org-id>')
  .description('Switch to a different organization')
  .action(async (orgId) => {
    try {
      const context = getMinimalContext(program.opts());
      await orgSwitch(orgId, context);
    } catch (error) {
      handleError(error);
    }
  });

orgCmd
  .command('current')
  .description('Display current organization context')
  .option('--format <format>', 'Output format (json|table)')
  .action(async (options) => {
    try {
      const context = getMinimalContext({ ...program.opts(), ...options });
      await orgCurrent(context, { format: options.format });
    } catch (error) {
      handleError(error);
    }
  });

// ============ ENV COMMANDS ============
const envCmd = program.command('env').description('Environment context management');

envCmd
  .command('list')
  .description('List available environments')
  .option('--org <org-id>', 'Filter by organization')
  .option('--format <format>', 'Output format (json|table)')
  .action(async (options) => {
    try {
      const context = await getContext({ ...program.opts(), ...options });
      await envList(context, { org: options.org, format: options.format });
    } catch (error) {
      handleError(error);
    }
  });

envCmd
  .command('switch <env-id>')
  .description('Switch to a different environment')
  .action(async (envId) => {
    try {
      const context = getMinimalContext(program.opts());
      await envSwitch(envId, context);
    } catch (error) {
      handleError(error);
    }
  });

envCmd
  .command('current')
  .description('Display current environment context')
  .option('--format <format>', 'Output format (json|table)')
  .action(async (options) => {
    try {
      const context = getMinimalContext({ ...program.opts(), ...options });
      await envCurrent(context, { format: options.format });
    } catch (error) {
      handleError(error);
    }
  });

// ============ ARTIFACT COMMANDS ============
const artifactCmd = program.command('artifact').description('Artifact operations (lifecycle-oriented)');

artifactCmd
  .command('plan <spec-path>')
  .description('Generate execution plan from specification')
  .option('--output <path>', 'Output file path')
  .option('--format <format>', 'Output format (json|yaml)')
  .action(async (specPath, options) => {
    try {
      const context = await getContext({ ...program.opts(), ...options });
      await artifactPlan(specPath, context, options);
    } catch (error) {
      handleError(error);
    }
  });

artifactCmd
  .command('inspect <artifact-id>')
  .description('Inspect artifact metadata')
  .option('--format <format>', 'Output format (json|table)')
  .option('--provenance', 'Show provenance details', true)
  .option('--dependencies', 'Show dependencies')
  .action(async (artifactId, options) => {
    try {
      const context = await getContext({ ...program.opts(), ...options });
      await artifactInspect(artifactId, context, {
        format: options.format,
        showProvenance: options.provenance,
        showDependencies: options.dependencies,
      });
    } catch (error) {
      handleError(error);
    }
  });

artifactCmd
  .command('diff <artifact-a> <artifact-b>')
  .description('Compare two artifacts')
  .option('--format <format>', 'Output format (json|unified|side-by-side)')
  .option('--metadata', 'Include metadata in diff')
  .action(async (artifactA, artifactB, options) => {
    try {
      const context = await getContext({ ...program.opts(), ...options });
      await artifactDiff(artifactA, artifactB, context, {
        format: options.format,
        showMetadata: options.metadata,
      });
    } catch (error) {
      handleError(error);
    }
  });

artifactCmd
  .command('list')
  .description('List artifacts in context')
  .option('--env <env-id>', 'Filter by environment')
  .option('--type <type>', 'Filter by type (plan|config|manifest|export)')
  .option('--format <format>', 'Output format (json|table)')
  .option('--limit <n>', 'Limit results', parseInt)
  .action(async (options) => {
    try {
      const context = await getContext({ ...program.opts(), ...options });
      await artifactList(context, options);
    } catch (error) {
      handleError(error);
    }
  });

// ============ INTENT COMMANDS ============
const intentCmd = program.command('intent').description('Intent lifecycle management');

intentCmd
  .command('submit')
  .description('Submit a new governance intent')
  .requiredOption('--type <type>', 'Intent type (deployment|configuration|scaling|rollback|migration)')
  .requiredOption('--target <target>', 'Intent target')
  .option('--metadata <json>', 'Additional metadata (JSON)')
  .action(async (options) => {
    try {
      const context = await getContext({ ...program.opts(), ...options });
      await intentSubmit(context, {
        type: options.type,
        target: options.target,
        metadata: options.metadata ? JSON.parse(options.metadata) : undefined,
      });
    } catch (error) {
      handleError(error);
    }
  });

intentCmd
  .command('status <intent-id>')
  .description('Check intent status')
  .option('--format <format>', 'Output format (json|table)')
  .action(async (intentId, options) => {
    try {
      const context = await getContext({ ...program.opts(), ...options });
      await intentStatus(intentId, context, { format: options.format });
    } catch (error) {
      handleError(error);
    }
  });

intentCmd
  .command('approve <intent-id>')
  .description('Approve a pending intent')
  .action(async (intentId) => {
    try {
      const context = await getContext(program.opts());
      await intentApprove(intentId, context);
    } catch (error) {
      handleError(error);
    }
  });

intentCmd
  .command('reject <intent-id>')
  .description('Reject a pending intent')
  .requiredOption('--reason <text>', 'Rejection reason')
  .action(async (intentId, options) => {
    try {
      const context = await getContext({ ...program.opts(), ...options });
      await intentReject(intentId, context, { reason: options.reason });
    } catch (error) {
      handleError(error);
    }
  });

intentCmd
  .command('list')
  .description('List intents')
  .option('--status <status>', 'Filter by status')
  .option('--format <format>', 'Output format (json|table)')
  .option('--limit <n>', 'Limit results', parseInt)
  .action(async (options) => {
    try {
      const context = await getContext({ ...program.opts(), ...options });
      await intentList(context, options);
    } catch (error) {
      handleError(error);
    }
  });

intentCmd
  .command('promote <source-env> <target-env>')
  .description('Promote artifacts between environments')
  .option('--artifacts <ids>', 'Specific artifact IDs (comma-separated)')
  .action(async (sourceEnv, targetEnv, options) => {
    try {
      const context = await getContext({ ...program.opts(), ...options });
      await intentPromote(sourceEnv, targetEnv, context, {
        artifactIds: options.artifacts?.split(','),
      });
    } catch (error) {
      handleError(error);
    }
  });

// ============ ARCHITECTURE COMMANDS ============
const archCmd = program.command('arch').description('Architecture introspection (read-only)');

archCmd
  .command('layers')
  .description('Display layer definitions')
  .option('--format <format>', 'Output format (json|table)')
  .action(async (options) => {
    try {
      const context = getMinimalContext({ ...program.opts(), ...options });
      await archLayers(context, { format: options.format });
    } catch (error) {
      handleError(error);
    }
  });

archCmd
  .command('boundaries')
  .description('Display forbidden paths')
  .option('--format <format>', 'Output format (json|table)')
  .option('--class <class>', 'Filter by repository class')
  .action(async (options) => {
    try {
      const context = getMinimalContext({ ...program.opts(), ...options });
      await archBoundaries(context, { format: options.format, class: options.class });
    } catch (error) {
      handleError(error);
    }
  });

archCmd
  .command('repos')
  .description('Display repository classifications')
  .option('--format <format>', 'Output format (json|table)')
  .option('--class <class>', 'Filter by class')
  .option('--layer <n>', 'Filter by layer', parseInt)
  .action(async (options) => {
    try {
      const context = getMinimalContext({ ...program.opts(), ...options });
      await archRepos(context, { format: options.format, class: options.class, layer: options.layer });
    } catch (error) {
      handleError(error);
    }
  });

archCmd
  .command('validate <path>')
  .description('Validate path against architecture rules')
  .option('--format <format>', 'Output format (json|table)')
  .option('--strict', 'Exit with error code on violations')
  .action(async (path, options) => {
    try {
      const context = getMinimalContext({ ...program.opts(), ...options });
      await archValidate(path, context, { format: options.format, strict: options.strict });
    } catch (error) {
      handleError(error);
    }
  });

// ============ ERP SURFACE COMMANDS ============
const erpCmd = program.command('erp').description('ERP surface introspection (read-only)');

erpCmd
  .command('domains')
  .description('List available ERP capability domains')
  .option('--format <format>', 'Output format (json|table)')
  .option('--domain <domain>', 'Filter by specific domain')
  .option('--verbose', 'Show detailed capability information')
  .action(async (options) => {
    try {
      const context = getMinimalContext({ ...program.opts(), ...options });
      await erpDomains(context, {
        format: options.format,
        domain: options.domain,
        verbose: options.verbose,
      });
    } catch (error) {
      handleError(error);
    }
  });

erpCmd
  .command('events')
  .description('List supported ERP events')
  .option('--format <format>', 'Output format (json|table)')
  .option('--domain <domain>', 'Filter by domain')
  .option('--category <category>', 'Filter by event category')
  .option('--direction <direction>', 'Filter by direction (inbound|outbound)')
  .action(async (options) => {
    try {
      const context = getMinimalContext({ ...program.opts(), ...options });
      await erpEvents(context, {
        format: options.format,
        domain: options.domain,
        category: options.category,
        direction: options.direction,
      });
    } catch (error) {
      handleError(error);
    }
  });

erpCmd
  .command('references')
  .description('Show simulations and intents referencing ERP surfaces')
  .option('--format <format>', 'Output format (json|table)')
  .option('--type <type>', 'Filter by reference type (simulation|intent|all)')
  .option('--domain <domain>', 'Filter by domain')
  .action(async (options) => {
    try {
      const context = getMinimalContext({ ...program.opts(), ...options });
      await erpReferences(context, {
        format: options.format,
        type: options.type,
        domain: options.domain,
      });
    } catch (error) {
      handleError(error);
    }
  });

// Parse and run
program.parse();
