/**
 * Command dispatcher - routes commands through validation pipeline
 */

import type { ExecutionContext } from '../types/context.js';
import type { CliFlags } from '../context/types.js';
import { resolveContext } from '../context/resolver.js';
import { validateOrThrow } from '../policy/validator.js';
import { withInterceptors } from './interceptor.js';
import { forward } from '../delegation/forwarder.js';
import { executeDryRun, type DryRunAction } from '../delegation/dry-run.js';

/** Command handler function type */
export type CommandHandler = (
  args: string[],
  context: ExecutionContext
) => Promise<void>;

/** Command definition */
export interface CommandDefinition {
  name: string;
  description: string;
  handler: CommandHandler;
  requiresContext: boolean;
  delegateToAgentics: boolean;
  policyPath?: string;
}

/** Registered commands */
const commands = new Map<string, CommandDefinition>();

/**
 * Register a command
 */
export function registerCommand(definition: CommandDefinition): void {
  commands.set(definition.name, definition);
}

/**
 * Get a registered command
 */
export function getCommand(name: string): CommandDefinition | undefined {
  return commands.get(name);
}

/**
 * List all registered commands
 */
export function listCommands(): CommandDefinition[] {
  return Array.from(commands.values());
}

/**
 * Dispatch a command through the validation pipeline
 */
export async function dispatch(
  commandName: string,
  args: string[],
  flags: CliFlags
): Promise<void> {
  const command = commands.get(commandName);

  if (!command) {
    throw new Error(`Unknown command: ${commandName}`);
  }

  // Resolve context if required
  let context: ExecutionContext;
  if (command.requiresContext) {
    const resolved = await resolveContext(flags);
    context = resolved.context;
  } else {
    // Minimal context for commands that don't require org/env
    context = {
      org: { orgId: 'none' },
      env: { envId: 'none', envType: 'development' },
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      dryRun: flags.dryRun ?? false,
    };
  }

  // Override dry-run from flags
  context.dryRun = flags.dryRun ?? false;

  // Validate against policy if path specified
  if (command.policyPath) {
    await validateOrThrow(command.policyPath);
  }

  // Execute with interceptors
  await withInterceptors(
    commandName,
    args,
    context,
    async () => {
      await command.handler(args, context);
    }
  );
}

/**
 * Dispatch to agentics CLI with dry-run support
 */
export async function dispatchToAgentics(
  command: string,
  args: string[],
  context: ExecutionContext,
  dryRunActions?: DryRunAction[]
): Promise<void> {
  if (context.dryRun && dryRunActions) {
    executeDryRun(command, args, context, dryRunActions);
    return;
  }

  await forward(command, args, context);
}

/**
 * Create a simple command handler that delegates to agentics CLI
 */
export function createDelegatingHandler(
  agenticsCommand: string
): CommandHandler {
  return async (args: string[], context: ExecutionContext) => {
    await dispatchToAgentics(agenticsCommand, args, context);
  };
}
