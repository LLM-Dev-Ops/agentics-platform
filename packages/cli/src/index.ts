#!/usr/bin/env node

/**
 * Agentics CLI - Command-line interface for the Layer 4 Agentics Platform
 *
 * This is a THIN REMOTE CONTROL that calls the Layer 4 API.
 * NO local computation, simulation, or intelligence execution.
 */

import { Command } from 'commander';
import { setApiKey, setEndpoint, setFormat } from './config.js';
import { createLoginCommand } from './commands/login.js';
import { createWhoamiCommand } from './commands/whoami.js';
import { createSimulateCommand } from './commands/simulate.js';
import { createIntelligenceCommand } from './commands/intelligence.js';
import { createSecurityCommand } from './commands/security.js';
import { createAutomationCommand } from './commands/automation.js';
import { createApiKeysCommand } from './commands/api-keys.js';
import { createUsageCommand } from './commands/usage.js';

// Package version
const VERSION = '0.1.0';

/**
 * Create and configure the main CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('agentics')
    .description('Command-line interface for the Layer 4 Agentics Platform')
    .version(VERSION)
    .option('--api-key <key>', 'API key for authentication')
    .option(
      '--endpoint <url>',
      'API endpoint URL',
      'https://api.agentics.dev/v1'
    )
    .option('--format <format>', 'Default output format (json, table)', 'table')
    .hook('preAction', (thisCommand) => {
      // Process global options before running any command
      const opts = thisCommand.opts();

      if (opts.apiKey) {
        setApiKey(opts.apiKey);
      }

      if (opts.endpoint) {
        setEndpoint(opts.endpoint);
      }

      if (opts.format) {
        setFormat(opts.format as 'json' | 'table');
      }
    });

  // Register all commands
  program.addCommand(createLoginCommand());
  program.addCommand(createWhoamiCommand());
  program.addCommand(createSimulateCommand());
  program.addCommand(createIntelligenceCommand());
  program.addCommand(createSecurityCommand());
  program.addCommand(createAutomationCommand());
  program.addCommand(createApiKeysCommand());
  program.addCommand(createUsageCommand());

  return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the CLI
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
