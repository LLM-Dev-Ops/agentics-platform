/**
 * Decision Memo Agent
 *
 * EXECUTIVE REPORTING agent that generates structured decision memos
 * for governance review and archival.
 *
 * This agent:
 * - Aggregates DecisionEvents from upstream repositories
 * - Compiles rationale, evidence, and recommendations
 * - Produces formal decision memos
 * - Emits exactly ONE DecisionEvent per invocation
 *
 * This agent MUST NOT:
 * - Execute inference
 * - Modify upstream systems
 * - Enforce decisions automatically
 * - Connect directly to Google SQL
 */

import type {
  DecisionEvent,
  DecisionType,
  AgentContract,
  ConstraintsApplied,
  OutputPayload,
} from '@agentics/contracts';
import { createDefaultConstraints } from '@agentics/contracts';
import { BaseAgent, type AgentInput, type AgentOutput, type AgentConfig } from '../base/agent.js';
import type { AgentContext } from '../base/context.js';
import type { DecisionMemo, DecisionMemoOptions, ConfidenceResult } from './types.js';
import { generateDecisionMemo } from './memo-generator.js';

/**
 * Decision Memo Agent input
 */
export interface DecisionMemoInput extends AgentInput {
  options?: DecisionMemoOptions;
}

/**
 * Decision Memo Agent output
 */
export interface DecisionMemoOutput extends AgentOutput {
  memo: DecisionMemo;
  confidence: ConfidenceResult;
}

/**
 * Agent constants
 */
export const AGENT_ID = 'decision-memo-agent';
export const AGENT_VERSION = '1.0.0';
export const DECISION_TYPE: DecisionType = 'governance_memo';

/**
 * Agent contract
 */
export const DECISION_MEMO_CONTRACT: AgentContract = {
  metadata: {
    id: AGENT_ID,
    version: AGENT_VERSION,
    name: 'Decision Memo Agent',
    description: 'Generates structured decision memos for governance review and archival by synthesizing DecisionEvents from upstream repositories.',
    classification: 'EXECUTIVE_REPORTING',
    decision_types: [DECISION_TYPE],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  capabilities: [
    {
      name: 'decide',
      description: 'Generate a complete decision memo from source events',
      input_schema: 'DecisionMemoInput',
      output_schema: 'DecisionMemoOutput',
    },
    {
      name: 'summarize',
      description: 'Generate an executive summary from source events',
      input_schema: 'DecisionMemoInput',
      output_schema: 'ExecutiveSummary',
    },
    {
      name: 'score',
      description: 'Calculate confidence score for source events',
      input_schema: 'DecisionMemoInput',
      output_schema: 'ConfidenceScore',
    },
    {
      name: 'inspect',
      description: 'Inspect agent state and configuration',
      input_schema: 'void',
      output_schema: 'AgentState',
    },
  ],
  invocation_modes: ['cli', 'cloud_run'],
  persistence: {
    persist: ['decision_event', 'summary', 'recommendation'],
    do_not_persist: [
      'raw_source_event_content',
      'intermediate_processing_state',
      'telemetry_events',
    ],
    retention_days: 365,
    collection: 'decision_memos',
  },
  boundaries: {
    must_not: [
      'Execute inference or LLM calls',
      'Modify prompts or responses',
      'Route requests to other services',
      'Trigger orchestration workflows',
      'Apply optimizations to systems',
      'Enforce governance actions automatically',
      'Connect directly to Google SQL',
      'Execute SQL queries',
    ],
    must_never: [
      'Intercept runtime traffic',
      'Execute workflows',
      'Route inference',
      'Enforce policies automatically',
      'Optimize live configurations',
      'Invoke other agents directly',
    ],
  },
  consumers: [
    'governance-dashboard',
    'audit-system',
    'executive-reporting-service',
    'compliance-tracker',
    'decision-archive',
  ],
  dependencies: ['ruvector-service'],
};

/**
 * Decision Memo Agent
 */
export class DecisionMemoAgent extends BaseAgent<DecisionMemoInput, DecisionMemoOutput> {
  public readonly agentId = AGENT_ID;
  public readonly agentVersion = AGENT_VERSION;
  public readonly contract = DECISION_MEMO_CONTRACT;
  public readonly decisionType = DECISION_TYPE;

  constructor(config: AgentConfig) {
    super(config);
  }

  protected async execute(
    input: DecisionMemoInput,
    sourceEvents: DecisionEvent[],
    context: AgentContext
  ): Promise<{
    outputs: OutputPayload;
    confidence: number;
    constraints: ConstraintsApplied;
    summary?: string;
  }> {
    // Assert boundaries
    this.assertBoundary(
      !this.isInferenceLike(input),
      'Agent must not execute inference',
      context
    );

    // Generate the decision memo
    const result = await generateDecisionMemo(sourceEvents, input.options || {});

    // Build constraints
    const constraints = this.buildConstraints(input, sourceEvents);

    return {
      outputs: {
        summary: result.memo.executive_summary,
        recommendation: result.memo.recommendations[0]?.action,
        risk_level: result.memo.risk_summary.overall_level,
        data: {
          memo_id: result.memo.memo_id,
          section_count: result.memo.sections.length,
          recommendation_count: result.memo.recommendations.length,
        },
        artifacts: [{
          type: 'decision_memo',
          content: result.memo,
        }],
      },
      confidence: result.confidence.overall,
      constraints,
      summary: result.memo.executive_summary,
    };
  }

  private isInferenceLike(input: DecisionMemoInput): boolean {
    // Heuristic to detect inference-like requests
    const suspicious = ['generate text', 'complete', 'predict', 'classify'];
    const inputStr = JSON.stringify(input).toLowerCase();
    return suspicious.some(s => inputStr.includes(s));
  }

  private buildConstraints(
    input: DecisionMemoInput,
    sourceEvents: DecisionEvent[]
  ): ConstraintsApplied {
    const constraints = createDefaultConstraints();

    constraints.assumptions = [
      'Source events are valid DecisionEvents from trusted upstream agents',
      'ruvector-service is available for persistence',
      'All timestamps are in UTC',
    ];

    constraints.scope_limits = [
      'Analysis limited to provided source events',
      'No real-time data integration',
      'No cross-system correlation beyond provided events',
    ];

    const sourceAgents = [...new Set(sourceEvents.map(e => e.agent_id))];
    constraints.data_sources = sourceAgents.map(id => `agent:${id}`);

    if (input.time_range) {
      constraints.analysis_window = `${input.time_range.start}/${input.time_range.end}`;
    }

    if (input.options?.min_confidence_threshold) {
      constraints.constraints.push({
        type: 'confidence_threshold',
        description: `Events below ${input.options.min_confidence_threshold} confidence are excluded`,
        impact: 'medium',
      });
    }

    constraints.dependencies = [
      {
        service: 'ruvector-service',
        status: 'available',
        fallback_used: false,
      },
    ];

    return constraints;
  }
}

/**
 * Create Decision Memo Agent instance
 */
export function createDecisionMemoAgent(config: AgentConfig): DecisionMemoAgent {
  return new DecisionMemoAgent(config);
}
