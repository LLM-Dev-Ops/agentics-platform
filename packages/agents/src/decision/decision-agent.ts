/**
 * Decision Agent Implementation
 *
 * PROMPT 2 Implementation: Runtime and infrastructure.
 *
 * Classification: DECISION SYNTHESIS
 * Decision Type: decision_synthesis
 */

import type {
  DecisionEvent,
  DecisionType,
  AgentContract,
  ConstraintsApplied,
  OutputPayload,
} from '@agentics/contracts';
import { BaseAgent, type AgentInput, type AgentOutput, type AgentConfig } from '../base/agent.js';
import type { AgentContext } from '../base/context.js';
import { AgentValidationError } from '../base/errors.js';
import { DECISION_AGENT_CONTRACT } from './contract.js';
import { synthesizeDecision } from './synthesis.js';

/**
 * Decision Agent Input
 */
export interface DecisionAgentInput extends AgentInput {
  /** Synthesis mode */
  mode?: 'aggregate' | 'resolve_conflicts' | 'consensus';

  /** Minimum confidence threshold for source events */
  min_confidence?: number;

  /** Decision types to include */
  decision_types?: DecisionType[];

  /** Agent IDs to include */
  agent_ids?: string[];
}

/**
 * Decision Agent Output
 */
export interface DecisionAgentOutput extends AgentOutput {
  /** Detailed synthesis result */
  synthesis: {
    eventsProcessed: number;
    conflictsResolved: number;
    recommendation: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

/**
 * Decision Agent
 *
 * Synthesizes multiple DecisionEvents into a single actionable
 * platform-level decision recommendation.
 *
 * This agent:
 * - Aggregates upstream DecisionEvents
 * - Resolves conflicts and tradeoffs
 * - Emits a final decision recommendation
 *
 * This agent MUST NOT:
 * - Execute inference
 * - Modify prompts or responses
 * - Route requests
 * - Trigger orchestration
 * - Apply optimizations
 * - Enforce governance actions automatically
 */
export class DecisionAgent extends BaseAgent<DecisionAgentInput, DecisionAgentOutput> {
  public readonly agentId = 'decision-agent';
  public readonly agentVersion = '0.1.0';
  public readonly contract: AgentContract = DECISION_AGENT_CONTRACT;
  public readonly decisionType: DecisionType = 'decision_synthesis';

  constructor(config: AgentConfig) {
    super(config);
  }

  /**
   * Validate input
   */
  protected override async validateInput(
    input: DecisionAgentInput,
    context: AgentContext
  ): Promise<void> {
    await super.validateInput(input, context);

    // Must have at least one source of events
    if (
      !input.source_event_ids?.length &&
      !input.source_events?.length &&
      !input.time_range
    ) {
      throw new AgentValidationError(
        'Decision Agent requires source events, event IDs, or a time range',
        this.agentId,
        [{ field: 'input', message: 'At least one event source is required' }],
        context.correlationId
      );
    }

    // Validate confidence threshold
    if (input.min_confidence !== undefined) {
      if (input.min_confidence < 0 || input.min_confidence > 1) {
        throw new AgentValidationError(
          'min_confidence must be between 0 and 1',
          this.agentId,
          [{ field: 'min_confidence', message: 'Must be between 0 and 1' }],
          context.correlationId
        );
      }
    }
  }

  /**
   * Execute decision synthesis
   */
  protected override async execute(
    input: DecisionAgentInput,
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
      sourceEvents.every(e => e.event_id !== undefined),
      'Source events must have valid event IDs',
      context
    );

    // Filter by confidence if specified
    let filteredEvents = sourceEvents;
    if (input.min_confidence !== undefined) {
      filteredEvents = sourceEvents.filter(e => e.confidence >= input.min_confidence!);
    }

    // Filter by decision types if specified
    if (input.decision_types?.length) {
      filteredEvents = filteredEvents.filter(e =>
        input.decision_types!.includes(e.decision_type)
      );
    }

    // Filter by agent IDs if specified
    if (input.agent_ids?.length) {
      filteredEvents = filteredEvents.filter(e =>
        input.agent_ids!.includes(e.agent_id)
      );
    }

    // Perform synthesis
    const synthesis = synthesizeDecision(filteredEvents);

    // Build output payload
    const outputs: OutputPayload = {
      recommendation: synthesis.recommendation,
      summary: synthesis.summary,
      risk_level: synthesis.riskLevel,
      data: {
        events_processed: synthesis.eventsProcessed,
        conflicts_resolved: synthesis.conflictsResolved,
        source_agents: [...new Set(filteredEvents.map(e => e.agent_id))],
        source_decision_types: [...new Set(filteredEvents.map(e => e.decision_type))],
        time_range: input.time_range,
      },
    };

    return {
      outputs,
      confidence: synthesis.confidence,
      constraints: synthesis.constraints,
      summary: synthesis.summary,
    };
  }

  /**
   * Create CLI-friendly output
   */
  override createCliOutput(
    output: DecisionAgentOutput,
    startTime: number
  ): import('@agentics/contracts').CliOutput {
    const base = super.createCliOutput(output, startTime);
    return {
      ...base,
      data: {
        ...(base.data as Record<string, unknown>),
        synthesis: output.synthesis,
      },
    };
  }
}

/**
 * Create a Decision Agent instance
 */
export function createDecisionAgent(config: AgentConfig): DecisionAgent {
  return new DecisionAgent(config);
}
