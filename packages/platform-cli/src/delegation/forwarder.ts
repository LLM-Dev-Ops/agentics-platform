/**
 * Pure call-forwarder to @agentics/cli
 *
 * IMPORTANT: This module forwards calls directly to the agentics CLI
 * without any semantic transformation. Arguments are passed through as-is.
 */

import { spawn, type SpawnOptions } from 'child_process';
import type { ExecutionContext } from '../types/context.js';
import { DelegationError } from '../errors.js';

/**
 * Forward a command to the agentics CLI
 *
 * @param command - The command to forward (e.g., 'intent', 'artifact')
 * @param args - Command arguments (passed directly, no transformation)
 * @param context - Execution context (attached via environment variables)
 */
export async function forward(
  command: string,
  args: string[],
  context: ExecutionContext
): Promise<void> {
  // Attach context as environment variables only - no transformation
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    AGENTICS_ORG: context.org.orgId,
    AGENTICS_ENV: context.env.envId,
    AGENTICS_CORRELATION_ID: context.correlationId,
    AGENTICS_DRY_RUN: context.dryRun ? 'true' : 'false',
  };

  const spawnOptions: SpawnOptions = {
    env,
    stdio: 'inherit',  // Pass through all I/O directly
    shell: false,
  };

  // Forward directly to agentics CLI - no argument transformation
  const child = spawn('agentics', [command, ...args], spawnOptions);

  return new Promise((resolve, reject) => {
    child.on('error', (error) => {
      reject(new DelegationError(
        error.message,
        `agentics ${command} ${args.join(' ')}`,
        error
      ));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new DelegationError(
          `Command exited with code ${code}`,
          `agentics ${command} ${args.join(' ')}`
        ));
      }
    });
  });
}

/**
 * Check if the agentics CLI is available
 */
export async function isAgenticsCliAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('which', ['agentics'], { stdio: 'pipe' });
    child.on('close', (code) => {
      resolve(code === 0);
    });
    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get the agentics CLI version
 */
export async function getAgenticsCliVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn('agentics', ['--version'], { stdio: 'pipe' });
    let output = '';

    child.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        resolve(null);
      }
    });

    child.on('error', () => {
      resolve(null);
    });
  });
}
