/**
 * DecisionEvent Schema
 *
 * The canonical schema for decision events across the Agentics Platform.
 * ALL agents MUST emit exactly ONE DecisionEvent per invocation.
 */

import { z } from 'zod';
import { decisionTypeSchema } from './decision-types.js';
import { constraintsAppliedSchema } from './constraints.js';

/**
 * Confidence level for a decision (0.0 to 1.0)
 */
export const confidenceSchema = z.number().min(0).max(1);
export type Confidence = z.infer<typeof confidenceSchema>;

/**
 * Input hash for deterministic verification
 */
export const inputsHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export type InputsHash = z.infer<typeof inputsHashSchema>;

/**
 * Agent identifier with version
 */
export const agentIdentifierSchema = z.object({
  agent_id: z.string().min(1),
  agent_version: z.string().regex(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i),
});
export type AgentIdentifier = z.infer<typeof agentIdentifierSchema>;

/**
 * Execution reference for tracing
 */
export const executionRefSchema = z.object({
  correlation_id: z.string().uuid(),
  trace_id: z.string().optional(),
  span_id: z.string().optional(),
  parent_span_id: z.string().optional(),
});
export type ExecutionRef = z.infer<typeof executionRefSchema>;

/**
 * Output payload - flexible but validated
 */
export const outputPayloadSchema = z.object({
  recommendation: z.string().optional(),
  summary: z.string().optional(),
  score: z.number().optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  data: z.record(z.unknown()).optional(),
  artifacts: z.array(z.object({
    type: z.string(),
    uri: z.string().url().optional(),
    content: z.unknown().optional(),
  })).optional(),
});
export type OutputPayload = z.infer<typeof outputPayloadSchema>;

/**
 * Source reference for upstream DecisionEvents
 */
export const sourceReferenceSchema = z.object({
  event_id: z.string().uuid(),
  agent_id: z.string(),
  decision_type: decisionTypeSchema,
  timestamp: z.string().datetime(),
});
export type SourceReference = z.infer<typeof sourceReferenceSchema>;

/**
 * DecisionEvent - The canonical event schema
 *
 * Every agent invocation MUST emit exactly ONE DecisionEvent.
 * This event is persisted to ruvector-service and consumed by
 * governance, audit, and executive systems.
 */
export const decisionEventSchema = z.object({
  // Event identity
  event_id: z.string().uuid(),

  // Agent identity
  agent_id: z.string().min(1),
  agent_version: z.string().regex(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i),

  // Decision classification
  decision_type: decisionTypeSchema,

  // Determinism verification
  inputs_hash: inputsHashSchema,

  // Decision output
  outputs: outputPayloadSchema,

  // Decision certainty (0.0 to 1.0)
  confidence: confidenceSchema,

  // Constraints and assumptions
  constraints_applied: constraintsAppliedSchema,

  // Execution context
  execution_ref: executionRefSchema,

  // Timing
  timestamp: z.string().datetime(),

  // Source events (for synthesis agents)
  source_events: z.array(sourceReferenceSchema).optional(),

  // Processing metadata
  processing_time_ms: z.number().int().nonnegative(),
});

export type DecisionEvent = z.infer<typeof decisionEventSchema>;

/**
 * Validate a DecisionEvent
 */
export function validateDecisionEvent(event: unknown): DecisionEvent {
  return decisionEventSchema.parse(event);
}

/**
 * Safe validation that returns result or error
 */
export function safeValidateDecisionEvent(event: unknown): {
  success: true;
  data: DecisionEvent;
} | {
  success: false;
  error: z.ZodError;
} {
  const result = decisionEventSchema.safeParse(event);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
