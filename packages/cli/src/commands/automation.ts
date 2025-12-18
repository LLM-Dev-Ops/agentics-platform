/**
 * Automation Command for Agentics CLI
 *
 * Workflow orchestration and automation management
 */

import { Command } from 'commander';
import { createClient, handleError } from '../client.js';
import { getFormat } from '../config.js';
import { formatJson, formatTable, spinner, success, info } from '../output.js';
import type { OutputFormat } from '../output.js';

/**
 * Workflows list command handler
 */
async function workflowsListHandler(options: {
  format?: OutputFormat;
}): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Fetching workflows...');

    const workflows = await client.listWorkflows();
    loadingSpinner.succeed('Workflows retrieved');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(workflows));
    } else {
      if (workflows.length === 0) {
        info('No workflows found');
        return;
      }

      console.log(formatTable(
        workflows.map((wf: any) => ({
          id: wf.id || 'N/A',
          name: wf.name || 'Unnamed',
          status: wf.status || 'unknown',
          created: wf.created_at || 'N/A',
        })),
        [
          { header: 'ID', key: 'id', width: 20 },
          { header: 'Name', key: 'name', width: 30 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Created', key: 'created', width: 25 },
        ]
      ));
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Workflows create command handler
 */
async function workflowsCreateHandler(options: {
  name?: string;
  config?: string;
  format?: OutputFormat;
}): Promise<void> {
  try {
    const client = createClient();

    if (!options.name) {
      throw new Error('--name is required');
    }

    let workflow: any = {
      name: options.name,
    };

    if (options.config) {
      // Load config file
      const fs = await import('fs/promises');
      const configContent = await fs.readFile(options.config, 'utf-8');
      try {
        workflow = { ...workflow, ...JSON.parse(configContent) };
      } catch {
        throw new Error('Invalid JSON in config file');
      }
    }

    const loadingSpinner = spinner('Creating workflow...');

    const result = await client.createWorkflow(workflow);
    loadingSpinner.succeed('Workflow created');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(result));
    } else {
      success(`Workflow created: ${(result as any).id || 'unknown'}`);
      info(`Name: ${(result as any).name || options.name}`);
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Workflows trigger command handler
 */
async function workflowsTriggerHandler(
  workflowId: string,
  options: {
    params?: string;
    format?: OutputFormat;
  }
): Promise<void> {
  try {
    const client = createClient();

    let params: any = {};

    if (options.params) {
      try {
        params = JSON.parse(options.params);
      } catch {
        throw new Error('Invalid JSON in --params');
      }
    }

    const loadingSpinner = spinner('Triggering workflow...');

    const result = await client.triggerWorkflow(workflowId, params);
    loadingSpinner.succeed('Workflow triggered');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(result));
    } else {
      success('Workflow triggered successfully');
      if ((result as any).execution_id) {
        info(`Execution ID: ${(result as any).execution_id}`);
        info(`\nTo check status, run:`);
        info(`  agentics automation workflows status ${workflowId} ${(result as any).execution_id}`);
      }
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Workflows status command handler
 */
async function workflowsStatusHandler(
  workflowId: string,
  executionId: string,
  options: { format?: OutputFormat }
): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Fetching workflow status...');

    const status = await client.getWorkflowStatus(workflowId, executionId);
    loadingSpinner.succeed('Status retrieved');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(status));
    } else {
      console.log('\nWorkflow Execution Status:');
      console.log(formatJson(status));
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Create and configure the automation command
 */
export function createAutomationCommand(): Command {
  const cmd = new Command('automation')
    .description('Workflow orchestration and automation');

  // Workflows subcommand
  const workflowsCmd = cmd
    .command('workflows')
    .description('Manage automation workflows');

  workflowsCmd
    .command('list')
    .description('List all workflows')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(workflowsListHandler);

  workflowsCmd
    .command('create')
    .description('Create a new workflow')
    .option('--name <name>', 'Workflow name (required)')
    .option('--config <path>', 'Path to workflow configuration file (JSON)')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(workflowsCreateHandler);

  workflowsCmd
    .command('trigger <workflow-id>')
    .description('Trigger a workflow execution')
    .option('--params <json>', 'Workflow parameters as JSON string')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(workflowsTriggerHandler);

  workflowsCmd
    .command('status <workflow-id> <execution-id>')
    .description('Get workflow execution status')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(workflowsStatusHandler);

  return cmd;
}
