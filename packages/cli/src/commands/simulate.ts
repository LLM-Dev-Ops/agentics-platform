/**
 * Simulate Command for Agentics CLI
 *
 * Initiates and manages SPARC simulations
 */

import { Command } from 'commander';
import { createClient, handleError } from '../client.js';
import { getFormat } from '../config.js';
import { formatJson, spinner, success, info } from '../output.js';
import type { OutputFormat } from '../output.js';
import type { SimulateParams } from '@agentics/shared';

/**
 * Poll simulation status until completion
 */
async function pollSimulation(
  simulationId: string,
  intervalMs: number = 2000
): Promise<void> {
  const client = createClient();
  const loadingSpinner = spinner('Simulation running...');

  let lastProgress = 0;

  const poll = async (): Promise<void> => {
    try {
      const status = await client.getSimulationStatus(simulationId);

      // Update spinner with progress
      if (status.progress !== lastProgress) {
        lastProgress = status.progress;
        loadingSpinner.text = `Simulation running... ${status.progress}%${
          status.current_step ? ` - ${status.current_step}` : ''
        }`;
      }

      // Check if completed
      if (
        status.status === 'completed' ||
        status.status === 'failed' ||
        status.status === 'cancelled'
      ) {
        if (status.status === 'completed') {
          loadingSpinner.succeed('Simulation completed');

          // Fetch full results
          const result = await client.getSimulationStatus(simulationId);
          console.log('\n' + formatJson(result));

          if (result.results) {
            info('\nResults summary:');
            if (result.results.artifacts) {
              info(`  Artifacts: ${result.results.artifacts.length}`);
            }
            if (result.results.metrics) {
              info(`  Execution time: ${result.results.metrics.execution_time}s`);
              info(`  Tokens used: ${result.results.metrics.tokens_used}`);
            }
          }
        } else if (status.status === 'failed') {
          loadingSpinner.fail('Simulation failed');
          if ((status as any).error) {
            console.error('\nError:', (status as any).error);
          }
        } else {
          loadingSpinner.warn('Simulation cancelled');
        }
        return;
      }

      // Continue polling
      setTimeout(poll, intervalMs);
    } catch (err) {
      loadingSpinner.fail('Error checking simulation status');
      throw err;
    }
  };

  await poll();
}

/**
 * Simulate command handler
 */
async function simulateHandler(options: {
  scenario?: string;
  config?: string;
  prompt?: string;
  duration?: number;
  users?: number;
  output?: string;
  follow?: boolean;
  format?: OutputFormat;
  name?: string;
  verbose?: boolean;
}): Promise<void> {
  try {
    const client = createClient();

    // Build simulation parameters
    const params: SimulateParams = {
      name: options.name,
      verbose: options.verbose,
    };

    if (options.prompt) {
      params.prompt = options.prompt;
    } else if (options.config) {
      // Load config file
      const fs = await import('fs/promises');
      const configContent = await fs.readFile(options.config, 'utf-8');
      try {
        params.specification = JSON.parse(configContent);
      } catch {
        // Try YAML
        params.specification = configContent;
      }
    } else if (options.scenario) {
      params.specification = {
        scenario: {
          description: options.scenario,
          type: 'custom',
        },
        parameters: {
          duration: options.duration,
          users: options.users,
        },
      };
    } else {
      throw new Error(
        'Please provide either --prompt, --config, or --scenario'
      );
    }

    const loadingSpinner = spinner('Starting simulation...');

    const result = await client.simulate(params);
    loadingSpinner.succeed('Simulation started');

    success(`Simulation ID: ${result.simulation_id}`);
    info(`Status: ${result.status}`);

    if (options.follow) {
      // Poll for completion
      console.log('');
      await pollSimulation(result.simulation_id);
    } else {
      info('\nTo check status, run:');
      info(`  agentics simulate status ${result.simulation_id}`);
    }

    if (options.output) {
      // Save simulation ID to file
      const fs = await import('fs/promises');
      await fs.writeFile(
        options.output,
        JSON.stringify(result, null, 2),
        'utf-8'
      );
      info(`Results saved to: ${options.output}`);
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Simulate status command handler
 */
async function simulateStatusHandler(
  simulationId: string,
  options: { format?: OutputFormat }
): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Fetching simulation status...');

    const status = await client.getSimulationStatus(simulationId);
    loadingSpinner.succeed('Status retrieved');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(status));
    } else {
      info(`Simulation ID: ${status.simulation_id}`);
      info(`Status: ${status.status}`);
      info(`Progress: ${status.progress}%`);
      if (status.current_step) {
        info(`Current step: ${status.current_step}`);
      }
      if (status.updated_at) {
        info(`Last updated: ${status.updated_at}`);
      }

      if (status.results) {
        console.log('\n' + formatJson(status.results));
      }
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Simulate cancel command handler
 */
async function simulateCancelHandler(simulationId: string): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Cancelling simulation...');

    await client.cancelSimulation(simulationId);
    loadingSpinner.succeed('Simulation cancelled');

    success(`Simulation ${simulationId} has been cancelled`);
  } catch (err) {
    handleError(err);
  }
}

/**
 * Create and configure the simulate command
 */
export function createSimulateCommand(): Command {
  const cmd = new Command('simulate')
    .description('Run SPARC-based simulations');

  // Main simulate command
  cmd
    .argument('[scenario]', 'Quick scenario description')
    .option('--config <path>', 'Path to SPARC specification file (JSON/YAML)')
    .option('--prompt <text>', 'Natural language prompt for simulation')
    .option('--duration <seconds>', 'Simulation duration', parseInt)
    .option('--users <count>', 'Number of simulated users', parseInt)
    .option('--output <path>', 'Save results to file')
    .option('--follow', 'Wait and display results when complete')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .option('--name <name>', 'Name for this simulation')
    .option('--verbose', 'Show detailed progress updates')
    .action((scenario, options) => {
      simulateHandler({ ...options, scenario });
    });

  // Status subcommand
  cmd
    .command('status <simulation-id>')
    .description('Check simulation status')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(simulateStatusHandler);

  // Cancel subcommand
  cmd
    .command('cancel <simulation-id>')
    .description('Cancel a running simulation')
    .action(simulateCancelHandler);

  return cmd;
}
