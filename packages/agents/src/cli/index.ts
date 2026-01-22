#!/usr/bin/env node
/**
 * Agentics Agent CLI
 *
 * CLI entry point for invoking agents directly.
 * Supports: decide, summarize, score, inspect commands
 *
 * PROMPT 3 Implementation: CLI wiring and verification
 */

import { Command } from 'commander';
import { createDecisionAgent } from '../decision/decision-agent.js';
import { createAgentContext } from '../base/context.js';
import type { DecisionAgentInput } from '../decision/decision-agent.js';
import { createRiskScoringAgent, type RiskScoringAgentInput } from '../risk-scoring/index.js';

const program = new Command();

program
  .name('agentics-agent')
  .description('Agentics Platform Agent CLI - Decision synthesis, executive reporting, and risk scoring')
  .version('0.1.0');

/**
 * Common options for all commands
 */
function addCommonOptions(cmd: Command): Command {
  return cmd
    .option('--ruvector-url <url>', 'RuVector service URL', process.env.RUVECTOR_SERVICE_URL)
    .option('--ruvector-key <key>', 'RuVector API key', process.env.RUVECTOR_API_KEY)
    .option('--dry-run', 'Do not persist the decision event', false)
    .option('--output <format>', 'Output format: json, yaml, table', 'json')
    .option('--verbose', 'Enable verbose output', false)
    .option('--correlation-id <id>', 'Correlation ID for tracing');
}

/**
 * Decision Agent: decide command
 *
 * Synthesize multiple DecisionEvents into a single actionable recommendation.
 */
addCommonOptions(
  program
    .command('decide')
    .description('Synthesize DecisionEvents into an actionable recommendation')
)
  .option('--source-events <ids...>', 'Source event IDs to process')
  .option('--input-file <path>', 'Path to JSON file containing input')
  .option('--time-start <datetime>', 'Start of time range (ISO 8601)')
  .option('--time-end <datetime>', 'End of time range (ISO 8601)')
  .option('--min-confidence <number>', 'Minimum confidence threshold (0-1)', parseFloat)
  .option('--decision-types <types...>', 'Filter by decision types')
  .option('--agent-ids <ids...>', 'Filter by agent IDs')
  .option('--mode <mode>', 'Synthesis mode: aggregate, resolve_conflicts, consensus', 'aggregate')
  .action(async (options) => {
    try {
      // Validate ruvector URL
      if (!options.ruvectorUrl && !options.dryRun) {
        console.error('Error: --ruvector-url is required (or set RUVECTOR_SERVICE_URL)');
        process.exit(1);
      }

      // Build input
      let input: DecisionAgentInput;

      if (options.inputFile) {
        const fs = await import('fs');
        const content = fs.readFileSync(options.inputFile, 'utf-8');
        input = JSON.parse(content);
      } else {
        input = {
          source_event_ids: options.sourceEvents,
          mode: options.mode,
          min_confidence: options.minConfidence,
          decision_types: options.decisionTypes,
          agent_ids: options.agentIds,
        };

        if (options.timeStart && options.timeEnd) {
          input.time_range = {
            start: options.timeStart,
            end: options.timeEnd,
          };
        }
      }

      // Create agent
      const agent = createDecisionAgent({
        ruvector: {
          baseUrl: options.ruvectorUrl || 'http://localhost:8080',
          apiKey: options.ruvectorKey,
        },
        telemetry: {
          enabled: options.verbose,
        },
        dryRun: options.dryRun,
      });

      // Create context
      const context = createAgentContext({
        correlationId: options.correlationId,
        mode: 'cli',
        source: 'agentics-agent-cli',
      });

      // Invoke agent
      const startTime = Date.now();
      const output = await agent.invoke(input, context);

      // Format output
      const cliOutput = agent.createCliOutput(output, startTime);

      if (options.output === 'json') {
        console.log(JSON.stringify(cliOutput, null, 2));
      } else if (options.output === 'yaml') {
        // Simple YAML-like output
        console.log(formatAsYaml(cliOutput));
      } else if (options.output === 'table') {
        console.log(formatAsTable(cliOutput));
      }

      process.exit(0);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      if (options.verbose) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  });

/**
 * Decision Agent: summarize command
 *
 * Generate a summary of decision events.
 */
addCommonOptions(
  program
    .command('summarize')
    .description('Generate a summary of decision events')
)
  .option('--time-start <datetime>', 'Start of time range (ISO 8601)')
  .option('--time-end <datetime>', 'End of time range (ISO 8601)')
  .option('--agent-ids <ids...>', 'Filter by agent IDs')
  .action(async (options) => {
    try {
      if (!options.ruvectorUrl) {
        console.error('Error: --ruvector-url is required (or set RUVECTOR_SERVICE_URL)');
        process.exit(1);
      }

      const agent = createDecisionAgent({
        ruvector: {
          baseUrl: options.ruvectorUrl,
          apiKey: options.ruvectorKey,
        },
        dryRun: true, // Summarize doesn't persist
      });

      const context = createAgentContext({
        correlationId: options.correlationId,
        mode: 'cli',
      });

      const input: DecisionAgentInput = {
        mode: 'aggregate',
        agent_ids: options.agentIds,
      };

      if (options.timeStart && options.timeEnd) {
        input.time_range = {
          start: options.timeStart,
          end: options.timeEnd,
        };
      }

      const output = await agent.invoke(input, context);

      console.log('\n=== Decision Summary ===\n');
      console.log(output.summary);
      console.log(`\nConfidence: ${(output.event.confidence * 100).toFixed(1)}%`);
      console.log(`Risk Level: ${output.event.outputs.risk_level}`);
      console.log(`Events Processed: ${output.event.outputs.data?.events_processed}`);

      process.exit(0);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

/**
 * Decision Agent: score command
 *
 * Calculate risk/confidence scores.
 */
addCommonOptions(
  program
    .command('score')
    .description('Calculate risk and confidence scores for decision events')
)
  .option('--source-events <ids...>', 'Source event IDs to score')
  .option('--time-start <datetime>', 'Start of time range (ISO 8601)')
  .option('--time-end <datetime>', 'End of time range (ISO 8601)')
  .action(async (options) => {
    try {
      if (!options.ruvectorUrl) {
        console.error('Error: --ruvector-url is required');
        process.exit(1);
      }

      const agent = createDecisionAgent({
        ruvector: {
          baseUrl: options.ruvectorUrl,
          apiKey: options.ruvectorKey,
        },
        dryRun: true,
      });

      const context = createAgentContext({ mode: 'cli' });

      const input: DecisionAgentInput = {
        source_event_ids: options.sourceEvents,
        mode: 'aggregate',
      };

      if (options.timeStart && options.timeEnd) {
        input.time_range = {
          start: options.timeStart,
          end: options.timeEnd,
        };
      }

      const output = await agent.invoke(input, context);

      console.log('\n=== Decision Scores ===\n');
      console.log(`Confidence: ${(output.event.confidence * 100).toFixed(1)}%`);
      console.log(`Risk Level: ${output.event.outputs.risk_level}`);
      console.log(`\nConstraints:`);
      output.event.constraints_applied.constraints.forEach(c => {
        console.log(`  - [${c.type}] ${c.description} (impact: ${c.impact})`);
      });

      process.exit(0);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

/**
 * Decision Agent: inspect command
 *
 * Inspect agent state and configuration.
 */
program
  .command('inspect')
  .description('Inspect agent configuration and contract')
  .option('--agent <id>', 'Agent ID to inspect', 'decision-agent')
  .action(async (_options) => {
    const agent = createDecisionAgent({
      ruvector: { baseUrl: 'http://localhost:8080' },
      dryRun: true,
    });

    console.log('\n=== Agent Contract ===\n');
    console.log(JSON.stringify(agent.contract, null, 2));

    console.log('\n=== Agent Metadata ===\n');
    console.log(`Agent ID: ${agent.agentId}`);
    console.log(`Version: ${agent.agentVersion}`);
    console.log(`Decision Type: ${agent.decisionType}`);
    console.log(`Classification: ${agent.contract.metadata.classification}`);

    console.log('\n=== Boundaries ===\n');
    console.log('MUST NOT:');
    agent.contract.boundaries.must_not.forEach(b => console.log(`  - ${b}`));
    console.log('\nMUST NEVER:');
    agent.contract.boundaries.must_never.forEach(b => console.log(`  - ${b}`));

    process.exit(0);
  });

/**
 * Format output as simple YAML
 */
function formatAsYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);
  const lines: string[] = [];

  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        lines.push(`${spaces}${key}:`);
        lines.push(formatAsYaml(value, indent + 1));
      } else {
        lines.push(`${spaces}${key}: ${value}`);
      }
    }
  } else {
    lines.push(`${spaces}${obj}`);
  }

  return lines.join('\n');
}

/**
 * Format output as table
 */
function formatAsTable(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push('┌─────────────────────┬────────────────────────────────────────────┐');
  lines.push('│ Field               │ Value                                      │');
  lines.push('├─────────────────────┼────────────────────────────────────────────┤');

  function addRow(key: string, value: unknown) {
    const keyStr = key.padEnd(19);
    const valStr = String(value).substring(0, 42).padEnd(42);
    lines.push(`│ ${keyStr} │ ${valStr} │`);
  }

  if (obj.success !== undefined) addRow('Success', obj.success);
  if (obj.event_id) addRow('Event ID', obj.event_id);
  if (obj.metadata) {
    const meta = obj.metadata as Record<string, unknown>;
    addRow('Agent ID', meta.agent_id);
    addRow('Agent Version', meta.agent_version);
    addRow('Execution Time', `${meta.execution_time_ms}ms`);
  }
  if (obj.data) {
    const data = obj.data as Record<string, unknown>;
    if (data.confidence) addRow('Confidence', `${(Number(data.confidence) * 100).toFixed(1)}%`);
    if (data.decision_type) addRow('Decision Type', data.decision_type);
  }

  lines.push('└─────────────────────┴────────────────────────────────────────────┘');
  return lines.join('\n');
}

/**
 * Risk Scoring Agent: risk-score command
 *
 * Assess and score platform-level risks.
 */
addCommonOptions(
  program
    .command('risk-score')
    .description('Assess and score platform-level risks')
)
  .option('--categories <categories...>', 'Risk categories to evaluate')
  .option('--methodology <method>', 'Scoring methodology: quantitative, qualitative, hybrid', 'hybrid')
  .option('--high-threshold <number>', 'High risk threshold (0-100)', parseFloat)
  .option('--time-start <datetime>', 'Start of time range (ISO 8601)')
  .option('--time-end <datetime>', 'End of time range (ISO 8601)')
  .action(async (options) => {
    try {
      if (!options.ruvectorUrl && !options.dryRun) {
        console.error('Error: --ruvector-url is required (or set RUVECTOR_SERVICE_URL)');
        process.exit(1);
      }

      // Create agent
      const agent = createRiskScoringAgent({
        ruvector: {
          baseUrl: options.ruvectorUrl || 'http://localhost:8080',
          apiKey: options.ruvectorKey,
        },
        telemetry: {
          enabled: options.verbose,
        },
        dryRun: options.dryRun,
      });

      // Create context
      const context = createAgentContext({
        correlationId: options.correlationId,
        mode: 'cli',
        source: 'agentics-agent-cli',
      });

      // Build input
      const input: RiskScoringAgentInput = {
        risk_categories: options.categories,
        methodology: options.methodology,
        high_risk_threshold: options.highThreshold,
      };

      if (options.timeStart && options.timeEnd) {
        input.time_range = {
          start: options.timeStart,
          end: options.timeEnd,
        };
      }

      // Execute
      const startTime = Date.now();
      const output = await agent.invoke(input, context);
      const cliOutput = agent.createCliOutput(output, startTime);

      if (options.output === 'json') {
        console.log(JSON.stringify(cliOutput, null, 2));
      } else {
        console.log('\n=== Risk Assessment ===\n');
        const data = output.event.outputs.data as {
          overall_risk_score: number;
          risk_level: string;
          risk_trend: string;
          top_risks: Array<{ description: string; score: number }>;
        };
        console.log(`Overall Risk Score: ${data.overall_risk_score}/100`);
        console.log(`Risk Level: ${output.event.outputs.risk_level?.toUpperCase()}`);
        console.log(`Risk Trend: ${data.risk_trend}`);
        console.log(`Confidence: ${(output.event.confidence * 100).toFixed(1)}%`);
        console.log(`\nTop Risks:`);
        data.top_risks?.slice(0, 5).forEach((risk, i) => {
          console.log(`  ${i + 1}. [${risk.score}] ${risk.description}`);
        });
      }

      process.exit(0);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      if (options.verbose) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  });

/**
 * Risk Scoring Agent: risk-inspect command
 *
 * Inspect Risk Scoring Agent state.
 */
program
  .command('risk-inspect')
  .description('Inspect Risk Scoring Agent configuration')
  .action(() => {
    const agent = createRiskScoringAgent({
      ruvector: { baseUrl: 'http://localhost:8080' },
      dryRun: true,
    });

    console.log('\n=== Risk Scoring Agent Contract ===\n');
    console.log(JSON.stringify(agent.contract, null, 2));

    console.log('\n=== Agent Metadata ===\n');
    console.log(`Agent ID: ${agent.agentId}`);
    console.log(`Version: ${agent.agentVersion}`);
    console.log(`Decision Type: ${agent.decisionType}`);
    console.log(`Classification: ${agent.contract.metadata.classification}`);

    console.log('\n=== Boundaries ===\n');
    console.log('MUST NOT:');
    agent.contract.boundaries.must_not.forEach(b => console.log(`  - ${b}`));
    console.log('\nMUST NEVER:');
    agent.contract.boundaries.must_never.forEach(b => console.log(`  - ${b}`));

    process.exit(0);
  });

/**
 * List all available agents
 */
program
  .command('list-agents')
  .description('List all available agents and their capabilities')
  .action(() => {
    console.log('\n=== Available Agents ===\n');

    console.log('1. Decision Agent (DECISION SYNTHESIS)');
    console.log('   Commands: decide, summarize, score, inspect');
    console.log('   Purpose: Synthesize DecisionEvents into actionable recommendations');
    console.log('');

    console.log('2. Executive Summary Agent (EXECUTIVE REPORTING)');
    console.log('   Commands: exec-summary, exec-inspect');
    console.log('   Purpose: Produce executive-grade summaries of platform state');
    console.log('');

    console.log('3. Risk Scoring Agent (RISK SCORING)');
    console.log('   Commands: risk-score, risk-inspect');
    console.log('   Purpose: Assess and score platform-level risks');
    console.log('');

    console.log('Constitutional Compliance:');
    console.log('  - All agents are stateless at runtime');
    console.log('  - All persistence via ruvector-service only');
    console.log('  - Each invocation emits exactly ONE DecisionEvent');
    console.log('  - No inference, routing, or orchestration');

    process.exit(0);
  });

// Parse CLI arguments
program.parse();
