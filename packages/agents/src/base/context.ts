/**
 * Agent Execution Context
 */

import { v4 as uuidv4 } from 'uuid';
import type { ExecutionRef } from '@agentics/contracts';

/**
 * Execution context for agent invocations
 */
export interface AgentContext {
  /** Unique correlation ID for this invocation */
  correlationId: string;

  /** Optional trace ID for distributed tracing */
  traceId?: string;

  /** Optional span ID */
  spanId?: string;

  /** Parent span ID */
  parentSpanId?: string;

  /** Invocation timestamp */
  timestamp: Date;

  /** Invocation mode */
  mode: 'cli' | 'cloud_run' | 'cloud_job' | 'edge_function';

  /** Source of invocation */
  source?: string;

  /** Request metadata */
  metadata: Record<string, unknown>;
}

/**
 * Create a new agent context
 */
export function createAgentContext(options?: Partial<AgentContext>): AgentContext {
  return {
    correlationId: options?.correlationId ?? uuidv4(),
    traceId: options?.traceId,
    spanId: options?.spanId ?? uuidv4(),
    parentSpanId: options?.parentSpanId,
    timestamp: options?.timestamp ?? new Date(),
    mode: options?.mode ?? 'cli',
    source: options?.source,
    metadata: options?.metadata ?? {},
  };
}

/**
 * Convert context to execution reference
 */
export function contextToExecutionRef(context: AgentContext): ExecutionRef {
  return {
    correlation_id: context.correlationId,
    trace_id: context.traceId,
    span_id: context.spanId,
    parent_span_id: context.parentSpanId,
  };
}

/**
 * Create child context for sub-operations
 */
export function createChildContext(parent: AgentContext): AgentContext {
  return {
    ...parent,
    spanId: uuidv4(),
    parentSpanId: parent.spanId,
    timestamp: new Date(),
  };
}
