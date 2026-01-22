/**
 * Metrics Schema
 *
 * Prometheus-compatible metrics definitions.
 */

import { z } from 'zod';

/**
 * Metric types
 */
export const metricTypeSchema = z.enum([
  'counter',
  'gauge',
  'histogram',
  'summary',
]);
export type MetricType = z.infer<typeof metricTypeSchema>;

/**
 * Metric definition
 */
export const metricDefinitionSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/),
  type: metricTypeSchema,
  help: z.string(),
  labels: z.array(z.string()).default([]),
  buckets: z.array(z.number()).optional(), // For histograms
});
export type MetricDefinition = z.infer<typeof metricDefinitionSchema>;

/**
 * Standard agent metrics
 */
export const AGENT_METRICS: MetricDefinition[] = [
  {
    name: 'agent_invocations_total',
    type: 'counter',
    help: 'Total number of agent invocations',
    labels: ['agent_id', 'decision_type', 'status'],
  },
  {
    name: 'agent_decision_confidence',
    type: 'histogram',
    help: 'Confidence scores of decisions',
    labels: ['agent_id', 'decision_type'],
    buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1.0],
  },
  {
    name: 'agent_processing_duration_seconds',
    type: 'histogram',
    help: 'Processing time for agent invocations',
    labels: ['agent_id', 'decision_type'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  },
  {
    name: 'agent_errors_total',
    type: 'counter',
    help: 'Total number of agent errors',
    labels: ['agent_id', 'error_type'],
  },
  {
    name: 'agent_source_events_processed',
    type: 'histogram',
    help: 'Number of source events processed per invocation',
    labels: ['agent_id'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  },
  {
    name: 'persistence_operations_total',
    type: 'counter',
    help: 'Total persistence operations',
    labels: ['agent_id', 'operation', 'status'],
  },
  {
    name: 'persistence_latency_seconds',
    type: 'histogram',
    help: 'Persistence operation latency',
    labels: ['agent_id', 'operation'],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  },
];

/**
 * Metric value with labels
 */
export interface MetricValue {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp?: number;
}

/**
 * Create metric value
 */
export function createMetricValue(
  name: string,
  value: number,
  labels: Record<string, string>
): MetricValue {
  return {
    name,
    value,
    labels,
    timestamp: Date.now(),
  };
}
