/**
 * Base Agent Class
 *
 * Abstract base class for all agentics-dev-platform agents.
 * Enforces the NON-NEGOTIABLE rules from the constitution.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  DecisionEvent,
  DecisionType,
  AgentContract,
  ConstraintsApplied,
  OutputPayload,
  CliOutput,
} from '@agentics/contracts';
import { computeInputsHash } from '@agentics/contracts';
import { RuvectorClient, DecisionEventStore } from '@agentics/ruvector-client';
import type { AgentContext } from './context.js';
import { contextToExecutionRef, createAgentContext } from './context.js';
import { DefaultTelemetryEmitter, createAgentTelemetryEvent } from './telemetry.js';
import type { TelemetryEmitter } from './telemetry.js';
import { AgentBoundaryViolationError, AgentPersistenceError } from './errors.js';

/**
 * Agent input base interface
 */
export interface AgentInput {
  /** Source event IDs to process */
  source_event_ids?: string[];

  /** Raw source events (alternative to IDs) */
  source_events?: DecisionEvent[];

  /** Time range for event aggregation */
  time_range?: {
    start: string;
    end: string;
  };

  /** Additional parameters */
  params?: Record<string, unknown>;
}

/**
 * Agent output base interface
 */
export interface AgentOutput {
  /** The synthesized decision event */
  event: DecisionEvent;

  /** Human-readable summary */
  summary?: string;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** RuVector service configuration */
  ruvector: {
    baseUrl: string;
    apiKey?: string;
    serviceToken?: string;
  };

  /** Telemetry configuration */
  telemetry?: {
    enabled: boolean;
    endpoint?: string;
  };

  /** Dry run mode (no persistence) */
  dryRun?: boolean;
}

/**
 * Base Agent Abstract Class
 *
 * All agentics-dev-platform agents MUST extend this class.
 */
export abstract class BaseAgent<
  TInput extends AgentInput = AgentInput,
  TOutput extends AgentOutput = AgentOutput
> {
  /** Agent identifier */
  public abstract readonly agentId: string;

  /** Agent version (semver) */
  public abstract readonly agentVersion: string;

  /** Agent contract */
  public abstract readonly contract: AgentContract;

  /** Decision type this agent produces */
  public abstract readonly decisionType: DecisionType;

  protected readonly ruvectorClient: RuvectorClient;
  protected readonly eventStore: DecisionEventStore;
  protected readonly config: AgentConfig;
  private _telemetry: TelemetryEmitter | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.ruvectorClient = new RuvectorClient(config.ruvector);
    this.eventStore = new DecisionEventStore(this.ruvectorClient);
  }

  protected get telemetry(): TelemetryEmitter {
    if (!this._telemetry) {
      this._telemetry = new DefaultTelemetryEmitter({
        agentId: this.agentId,
        agentVersion: this.agentVersion,
        enabled: this.config.telemetry?.enabled ?? true,
        endpoint: this.config.telemetry?.endpoint,
      });
    }
    return this._telemetry;
  }

  /**
   * Invoke the agent
   *
   * This is the main entry point. It:
   * 1. Validates input
   * 2. Executes the decision logic
   * 3. Emits exactly ONE DecisionEvent
   * 4. Persists to ruvector-service
   * 5. Emits telemetry
   */
  async invoke(input: TInput, context?: AgentContext): Promise<TOutput> {
    const ctx = context ?? createAgentContext({ mode: 'cli' });
    const startTime = Date.now();

    // Emit start telemetry
    this.telemetry.emit(createAgentTelemetryEvent(
      'agent.invocation.start',
      'info',
      `Agent ${this.agentId} invocation started`,
      ctx,
      this.agentId,
      this.agentVersion,
      { input_hash: computeInputsHash(input) }
    ));

    try {
      // Validate input
      await this.validateInput(input, ctx);

      // Fetch source events if IDs provided
      const sourceEvents = await this.resolveSourceEvents(input, ctx);

      // Execute agent-specific logic
      const result = await this.execute(input, sourceEvents, ctx);

      // Create the DecisionEvent
      const event = this.createDecisionEvent(input, result, ctx, startTime);

      // Persist (unless dry run)
      if (!this.config.dryRun) {
        await this.persist(event, ctx);
      }

      // Emit completion telemetry
      this.telemetry.emit(createAgentTelemetryEvent(
        'agent.invocation.end',
        'info',
        `Agent ${this.agentId} invocation completed`,
        ctx,
        this.agentId,
        this.agentVersion,
        {
          event_id: event.event_id,
          confidence: event.confidence,
          processing_time_ms: Date.now() - startTime,
        }
      ));

      return {
        event,
        summary: result.summary,
      } as TOutput;
    } catch (error) {
      // Emit error telemetry
      this.telemetry.emit(createAgentTelemetryEvent(
        'agent.error',
        'error',
        `Agent ${this.agentId} invocation failed: ${(error as Error).message}`,
        ctx,
        this.agentId,
        this.agentVersion,
        {
          error_type: (error as Error).name,
          error_message: (error as Error).message,
        }
      ));

      throw error;
    } finally {
      await this.telemetry.flush();
    }
  }

  /**
   * Execute the agent-specific decision logic
   *
   * Subclasses MUST implement this method.
   */
  protected abstract execute(
    input: TInput,
    sourceEvents: DecisionEvent[],
    context: AgentContext
  ): Promise<{
    outputs: OutputPayload;
    confidence: number;
    constraints: ConstraintsApplied;
    summary?: string;
  }>;

  /**
   * Validate input
   */
  protected async validateInput(input: TInput, _context: AgentContext): Promise<void> {
    // Base validation - subclasses can override
    if (!input.source_event_ids?.length && !input.source_events?.length && !input.time_range) {
      // Allow empty input for some agents
    }
  }

  /**
   * Resolve source events from IDs
   */
  protected async resolveSourceEvents(
    input: TInput,
    _context: AgentContext
  ): Promise<DecisionEvent[]> {
    if (input.source_events?.length) {
      return input.source_events;
    }

    if (input.source_event_ids?.length) {
      const events: DecisionEvent[] = [];
      for (const id of input.source_event_ids) {
        const event = await this.eventStore.get(id);
        events.push(event);
      }
      return events;
    }

    if (input.time_range) {
      const result = await this.eventStore.query({
        time_range: input.time_range,
      });
      return result.data;
    }

    return [];
  }

  /**
   * Create the DecisionEvent
   */
  private createDecisionEvent(
    input: TInput,
    result: {
      outputs: OutputPayload;
      confidence: number;
      constraints: ConstraintsApplied;
    },
    context: AgentContext,
    startTime: number
  ): DecisionEvent {
    return {
      event_id: uuidv4(),
      agent_id: this.agentId,
      agent_version: this.agentVersion,
      decision_type: this.decisionType,
      inputs_hash: computeInputsHash(input),
      outputs: result.outputs,
      confidence: result.confidence,
      constraints_applied: result.constraints,
      execution_ref: contextToExecutionRef(context),
      timestamp: new Date().toISOString(),
      source_events: input.source_events?.map(e => ({
        event_id: e.event_id,
        agent_id: e.agent_id,
        decision_type: e.decision_type,
        timestamp: e.timestamp,
      })),
      processing_time_ms: Date.now() - startTime,
    };
  }

  /**
   * Persist the DecisionEvent
   */
  private async persist(event: DecisionEvent, context: AgentContext): Promise<void> {
    try {
      await this.eventStore.write(event);

      this.telemetry.emit(createAgentTelemetryEvent(
        'persistence.write',
        'info',
        `Persisted DecisionEvent ${event.event_id}`,
        context,
        this.agentId,
        this.agentVersion,
        { event_id: event.event_id }
      ));
    } catch (error) {
      throw new AgentPersistenceError(
        `Failed to persist DecisionEvent: ${(error as Error).message}`,
        this.agentId,
        context.correlationId
      );
    }
  }

  /**
   * Assert agent boundaries
   *
   * Call this to verify the agent is not violating its boundaries.
   */
  protected assertBoundary(condition: boolean, violation: string, context: AgentContext): void {
    if (!condition) {
      throw new AgentBoundaryViolationError(violation, this.agentId, context.correlationId);
    }
  }

  /**
   * Create CLI output
   */
  createCliOutput(output: TOutput, startTime: number): CliOutput {
    return {
      success: true,
      event_id: output.event.event_id,
      data: {
        decision_type: output.event.decision_type,
        confidence: output.event.confidence,
        outputs: output.event.outputs,
        summary: output.summary,
      },
      metadata: {
        execution_time_ms: Date.now() - startTime,
        agent_id: this.agentId,
        agent_version: this.agentVersion,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
