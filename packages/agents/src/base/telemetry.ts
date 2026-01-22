/**
 * Agent Telemetry
 *
 * LLM-Observatory compatible telemetry emission.
 */

import pino, { Logger } from 'pino';
import type {
  TelemetryEvent,
  TelemetryEventType,
  TelemetrySeverity,
  MetricValue,
} from '@agentics/contracts';
import type { AgentContext } from './context.js';

/**
 * Telemetry emitter interface
 */
export interface TelemetryEmitter {
  emit(event: TelemetryEvent): void;
  metric(value: MetricValue): void;
  flush(): Promise<void>;
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  agentId: string;
  agentVersion: string;
  enabled: boolean;
  endpoint?: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

/**
 * Default telemetry emitter (logs to pino)
 */
export class DefaultTelemetryEmitter implements TelemetryEmitter {
  private readonly logger: Logger;
  private readonly config: TelemetryConfig;
  private readonly buffer: TelemetryEvent[] = [];
  private readonly metrics: MetricValue[] = [];

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.logger = pino.default ? pino.default({
      name: `agent:${config.agentId}`,
      level: 'info',
    }) : (pino as unknown as typeof pino.default)({
      name: `agent:${config.agentId}`,
      level: 'info',
    });
  }

  emit(event: TelemetryEvent): void {
    if (!this.config.enabled) return;

    this.buffer.push(event);

    // Log locally
    const level = this.severityToLevel(event.severity);
    this.logger[level]({
      event_type: event.event_type,
      correlation_id: event.correlation_id,
      ...event.data,
    }, event.message);

    // Batch and send if threshold reached
    if (this.buffer.length >= (this.config.batchSize ?? 100)) {
      this.flush().catch(err => this.logger.error(err, 'Failed to flush telemetry'));
    }
  }

  metric(value: MetricValue): void {
    if (!this.config.enabled) return;
    this.metrics.push(value);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 && this.metrics.length === 0) return;

    const events = [...this.buffer];
    const metrics = [...this.metrics];
    this.buffer.length = 0;
    this.metrics.length = 0;

    if (this.config.endpoint) {
      try {
        await fetch(this.config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events, metrics }),
        });
      } catch (error) {
        this.logger.error(error, 'Failed to send telemetry');
        // Re-add to buffer for retry
        this.buffer.push(...events);
        this.metrics.push(...metrics);
      }
    }
  }

  private severityToLevel(severity: TelemetrySeverity): pino.Level {
    switch (severity) {
      case 'debug': return 'debug';
      case 'info': return 'info';
      case 'warn': return 'warn';
      case 'error': return 'error';
      case 'critical': return 'fatal';
      default: return 'info';
    }
  }
}

/**
 * Create telemetry event helper
 */
export function createAgentTelemetryEvent(
  eventType: TelemetryEventType,
  severity: TelemetrySeverity,
  message: string,
  context: AgentContext,
  agentId: string,
  agentVersion: string,
  data?: Record<string, unknown>
): TelemetryEvent {
  return {
    event_type: eventType,
    severity,
    timestamp: new Date().toISOString(),
    agent_id: agentId,
    agent_version: agentVersion,
    correlation_id: context.correlationId,
    trace_id: context.traceId,
    span_id: context.spanId,
    message,
    data,
  };
}
