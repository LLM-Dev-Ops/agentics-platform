/**
 * ObservabilityService - Central coordinator for all observability concerns
 *
 * Singleton service providing:
 * - Metrics emission (request/error tracking)
 * - Audit logging (security events)
 * - Usage emission (billing/analytics)
 * - Correlation ID management (distributed tracing)
 *
 * This service ONLY emits observability data.
 * Analysis and aggregation are performed by downstream systems.
 */

import { MetricsEmitter } from './metrics';
import { AuditLogger, AuditEventType } from './audit';
import { UsageEmitter } from './usage-emission';
import {
  generateCorrelationId,
  attachCorrelationId,
  getCorrelationId,
  getLayer3Headers,
  getCorrelationContext,
} from './correlation';

export class ObservabilityService {
  private static instance: ObservabilityService;

  // Core components
  public readonly metrics: MetricsEmitter;
  public readonly audit: AuditLogger;
  public readonly usage: UsageEmitter;

  private constructor() {
    this.metrics = new MetricsEmitter();
    this.audit = new AuditLogger();
    this.usage = new UsageEmitter();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ObservabilityService {
    if (!ObservabilityService.instance) {
      ObservabilityService.instance = new ObservabilityService();
    }
    return ObservabilityService.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  public static resetInstance(): void {
    if (ObservabilityService.instance) {
      ObservabilityService.instance.metrics.reset();
      ObservabilityService.instance.audit.clear();
      ObservabilityService.instance.usage.clear();
    }
    ObservabilityService.instance = null as any;
  }

  /**
   * Emit a complete request observation
   * Combines metrics and usage emission
   */
  public recordRequest(params: {
    userId: string;
    endpoint: string;
    status: number;
    duration: number;
    requestSize: number;
    responseSize: number;
    tokens?: number;
    correlationId?: string;
    metadata?: { [key: string]: any };
  }): void {
    const {
      userId,
      endpoint,
      status,
      duration,
      requestSize,
      responseSize,
      tokens,
      correlationId,
      metadata,
    } = params;

    // Emit metrics
    this.metrics.emitRequestMetric(
      endpoint,
      status,
      duration / 1000, // Convert to seconds for metrics
      requestSize,
      responseSize
    );

    // Emit usage event
    this.usage.emitUsageEvent(
      userId,
      endpoint,
      new Date().toISOString(),
      tokens,
      duration,
      correlationId,
      metadata
    );
  }

  /**
   * Emit error observation
   */
  public recordError(params: {
    endpoint: string;
    errorCode: string;
    userId?: string;
    correlationId?: string;
  }): void {
    const { endpoint, errorCode } = params;

    // Emit error metric
    this.metrics.emitErrorMetric(endpoint, errorCode);

    // Error details are also captured in request metrics (via status code)
    // No separate audit event for general errors (only security-relevant events)
  }

  /**
   * Record audit event with correlation
   */
  public recordAudit(params: {
    eventType: AuditEventType;
    userId: string | null;
    metadata?: { [key: string]: any };
    correlationId?: string;
  }): void {
    const { eventType, userId, metadata, correlationId } = params;

    this.audit.logAuditEvent(eventType, userId, metadata, correlationId);
  }

  /**
   * Get health status of observability system
   */
  public getHealth(): {
    status: 'healthy' | 'degraded';
    components: {
      metrics: { status: string; count: number };
      audit: { status: string; count: number };
      usage: { status: string; count: number };
    };
  } {
    const metricsJson = this.metrics.getMetricsJson() as any;
    const auditStats = this.audit.getStatistics();
    const usageCount = this.usage.getTotalEvents();

    return {
      status: 'healthy',
      components: {
        metrics: {
          status: 'operational',
          count: Object.keys(metricsJson.counters?.api_request_total || {}).length,
        },
        audit: {
          status: 'operational',
          count: auditStats.totalEvents,
        },
        usage: {
          status: 'operational',
          count: usageCount,
        },
      },
    };
  }
}

// Export singleton instance getter
export const getObservabilityService = () => ObservabilityService.getInstance();

// Export component classes for direct access if needed
export { MetricsEmitter } from './metrics';
export { AuditLogger, AuditEventType } from './audit';
export { UsageEmitter } from './usage-emission';

// Export correlation utilities
export {
  generateCorrelationId,
  attachCorrelationId,
  getCorrelationId,
  getLayer3Headers,
  getCorrelationContext,
  correlationIdHook,
} from './correlation';

// Export types
export type { AuditEvent } from './audit';
export type { UsageEvent } from './usage-emission';
