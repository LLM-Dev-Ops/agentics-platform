/**
 * Intelligence Command for Agentics CLI
 *
 * AI/ML operations including completions and model management
 */

import { Command } from 'commander';
import { createClient, handleError } from '../client.js';
import { getFormat } from '../config.js';
import { formatJson, formatTable, spinner, info } from '../output.js';
import type { OutputFormat } from '../output.js';
import type { CompletionParams } from '@agentics/shared';

/**
 * Completions command handler
 */
async function completionsHandler(options: {
  model?: string;
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  format?: OutputFormat;
}): Promise<void> {
  try {
    const client = createClient();

    if (!options.prompt) {
      throw new Error('--prompt is required');
    }

    const params: CompletionParams = {
      model: options.model || 'gpt-4',
      prompt: options.prompt,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: options.stream,
    };

    if (options.stream) {
      // Note: Streaming not yet implemented in client
      info('Streaming mode - displaying response as it arrives:');
      console.log('');
    }

    const loadingSpinner = options.stream
      ? null
      : spinner('Generating completion...');

    const completion = await client.createCompletion(params);

    if (loadingSpinner) {
      loadingSpinner.succeed('Completion generated');
    }

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(completion));
    } else {
      console.log('\nCompletion:');
      console.log('─'.repeat(80));
      console.log(completion.completion);
      console.log('─'.repeat(80));

      console.log('\nUsage:');
      console.log(formatTable(
        [
          { metric: 'Prompt Tokens', value: completion.usage.prompt_tokens },
          { metric: 'Completion Tokens', value: completion.usage.completion_tokens },
          { metric: 'Total Tokens', value: completion.usage.total_tokens },
        ],
        [
          { header: 'Metric', key: 'metric' },
          { header: 'Value', key: 'value' },
        ]
      ));
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Models list command handler
 */
async function modelsListHandler(options: {
  format?: OutputFormat;
}): Promise<void> {
  try {
    const client = createClient();
    const loadingSpinner = spinner('Fetching models...');

    const response = await client.listModels();
    loadingSpinner.succeed('Models retrieved');

    const format = options.format || getFormat();

    if (format === 'json') {
      console.log(formatJson(response.models));
    } else {
      console.log(formatTable(
        response.models.map((model: any) => ({
          id: model.id,
          name: model.name,
          provider: model.provider || 'N/A',
          completion: model.capabilities.completion ? '✓' : '✗',
          chat: model.capabilities.chat ? '✓' : '✗',
          embeddings: model.capabilities.embeddings ? '✓' : '✗',
          max_tokens: model.capabilities.max_tokens || 'N/A',
        })),
        [
          { header: 'ID', key: 'id', width: 20 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Provider', key: 'provider', width: 15 },
          { header: 'Completion', key: 'completion', width: 10 },
          { header: 'Chat', key: 'chat', width: 6 },
          { header: 'Embeddings', key: 'embeddings', width: 10 },
          { header: 'Max Tokens', key: 'max_tokens', width: 10 },
        ]
      ));
    }
  } catch (err) {
    handleError(err);
  }
}

/**
 * Create and configure the intelligence command
 */
export function createIntelligenceCommand(): Command {
  const cmd = new Command('intelligence')
    .alias('ai')
    .description('AI/ML operations and model management');

  // Completions subcommand
  cmd
    .command('completions')
    .description('Generate text completions')
    .option('--model <model>', 'Model ID to use', 'gpt-4')
    .option('--prompt <text>', 'Input prompt (required)')
    .option('--max-tokens <number>', 'Maximum tokens to generate', parseInt)
    .option('--temperature <number>', 'Sampling temperature (0-2)', parseFloat)
    .option('--stream', 'Stream the response')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(completionsHandler);

  // Models subcommand
  const modelsCmd = cmd
    .command('models')
    .description('Model management');

  modelsCmd
    .command('list')
    .description('List available models')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action(modelsListHandler);

  return cmd;
}
