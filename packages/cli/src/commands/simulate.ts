/**
 * Simulate Command for Agentics CLI
 *
 * Initiates and manages SPARC simulations
 */

import { Command } from 'commander';
import { createClient, handleError } from '../client.js';
import { getApiKey, getEndpoint, getFormat } from '../config.js';
import { formatJson, spinner, success, info } from '../output.js';
import type { OutputFormat } from '../output.js';
import type { SimulateParams } from '../types.js';
import { consumeSse } from '../sse.js';

/**
 * ADR-012 — live-view URL printed to end users after a simulation is
 * created. AGENTICS_UI_URL overrides for dev.
 */
function getLiveViewUrl(simulationId: string): string {
  const base =
    process.env.AGENTICS_UI_URL ||
    process.env.AGENTICS_APP_URL ||
    'https://app.agentics.dev';
  return `${base.replace(/\/$/, '')}/simulations/${encodeURIComponent(simulationId)}`;
}

/**
 * ADR-011 — stream simulation events via SSE. Kept polling path under
 * --poll for air-gapped debugging.
 */
async function streamSimulation(simulationId: string): Promise<void> {
  const endpoint = getEndpoint();
  const apiKey = getApiKey();
  const url = `${endpoint}/v1/simulations/${encodeURIComponent(simulationId)}/events`;

  const loadingSpinner = spinner('Live stream...');
  let terminalKind: string | null = null;
  const abort = new AbortController();

  try {
    await consumeSse({
      url,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: abort.signal,
      shouldStop: () => terminalKind !== null,
      onMessage: async (msg) => {
        if (!msg.event || msg.event === 'end') {
          if (msg.event === 'end') abort.abort();
          return;
        }
        let envelope: any = {};
        try { envelope = msg.data ? JSON.parse(msg.data) : {}; } catch { /* ignore */ }
        const p = envelope.payload ?? {};

        switch (msg.event) {
          case 'simulation.step.started':
            loadingSpinner.text = `Running step: ${p.step ?? '?'}`;
            break;
          case 'simulation.step.completed':
            loadingSpinner.text = `Completed step: ${p.step ?? '?'}`;
            break;
          case 'simulation.metric':
            if (p.name) loadingSpinner.text = `${p.name}: ${p.value}${p.unit ? ' ' + p.unit : ''}`;
            break;
          case 'simulation.log':
            if (p.level === 'error' || p.level === 'warn') {
              info(`[${p.level}] ${p.message ?? ''}`);
            }
            break;
          case 'simulation.completed':
            terminalKind = msg.event;
            loadingSpinner.succeed('Simulation completed');
            abort.abort();
            break;
          case 'simulation.failed':
            terminalKind = msg.event;
            loadingSpinner.fail(`Simulation failed: ${p.error ?? 'unknown error'}`);
            abort.abort();
            break;
          case 'simulation.cancelled':
            terminalKind = msg.event;
            loadingSpinner.warn('Simulation cancelled');
            abort.abort();
            break;
        }
      },
    });
  } catch (err) {
    loadingSpinner.fail('Live stream error');
    throw err;
  }

  if (terminalKind === null) {
    loadingSpinner.stop();
    info('Stream ended before terminal event.');
  }
}

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
            const results = result.results as any;
            if (results.artifacts) {
              info(`  Artifacts: ${results.artifacts.length}`);
            }
            if (results.metrics) {
              info(`  Execution time: ${results.metrics.execution_time}s`);
              info(`  Tokens used: ${results.metrics.tokens_used}`);
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
  poll?: boolean;
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
    info(`View live: ${getLiveViewUrl(result.simulation_id)}`);

    if (options.follow) {
      console.log('');
      if (options.poll) {
        // Legacy polling path, retained for air-gapped debugging.
        await pollSimulation(result.simulation_id);
      } else {
        await streamSimulation(result.simulation_id);
      }
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
    .option('--follow', 'Stream live events until simulation completes (ADR-011 SSE)')
    .option('--poll', 'With --follow, use polling instead of SSE (air-gapped)')
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
