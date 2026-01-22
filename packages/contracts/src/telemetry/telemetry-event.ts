/**
 * Telemetry Event Schema
 *
 * LLM-Observatory compatible telemetry events.
 */

import { z } from 'zod';

/**
 * Telemetry event types
 */
export const telemetryEventTypeSchema = z.enum([
  'agent.invocation.start',
  'agent.invocation.end',
  'agent.decision.emit',
  'agent.error',
  'agent.validation.fail',
  'persistence.write',
  'persistence.read',
]);
export type TelemetryEventType = z.infer<typeof telemetryEventTypeSchema>;

/**
 * Telemetry severity levels
 */
export const telemetrySeveritySchema = z.enum([
  'debug',
  'info',
  'warn',
  'error',
  'critical',
]);
export type TelemetrySeverity = z.infer<typeof telemetrySeveritySchema>;

/**
 * Telemetry event schema
 */
export const telemetryEventSchema = z.object({
  event_type: telemetryEventTypeSchema,
  severity: telemetrySeveritySchema,
  timestamp: z.string().datetime(),

  // Context
  agent_id: z.string(),
  agent_version: z.string(),
  correlation_id: z.string().uuid(),
  trace_id: z.string().optional(),
  span_id: z.string().optional(),

  // Event data
  message: z.string(),
  data: z.record(z.unknown()).optional(),

  // Error details (if applicable)
  error: z.object({
    type: z.string(),
    message: z.string(),
    stack: z.string().optional(),
  }).optional(),

  // Metrics
  duration_ms: z.number().nonnegative().optional(),

  // Tags for filtering
  tags: z.record(z.string()).optional(),
});
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

/**
 * Create telemetry event
 */
export function createTelemetryEvent(
  eventType: TelemetryEventType,
  severity: TelemetrySeverity,
  message: string,
  context: {
    agentId: string;
    agentVersion: string;
    correlationId: string;
    traceId?: string;
    spanId?: string;
  },
  data?: Record<string, unknown>
): TelemetryEvent {
  return {
    event_type: eventType,
    severity,
    timestamp: new Date().toISOString(),
    agent_id: context.agentId,
    agent_version: context.agentVersion,
    correlation_id: context.correlationId,
    trace_id: context.traceId,
    span_id: context.spanId,
    message,
    data,
  };
}
