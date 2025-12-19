/**
 * Metrics Handler - Prometheus metrics endpoint
 *
 * Provides GET /metrics endpoint that returns metrics in Prometheus text format.
 * Protected by admin scope - internal use only.
 *
 * This endpoint should NOT be exposed publicly - only to internal monitoring systems.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { getObservabilityService } from '../services/observability/index.js';

/**
 * GET /metrics - Prometheus metrics endpoint
 *
 * Returns all metrics in Prometheus text format.
 * Should be protected by admin scope or IP whitelist.
 */
export async function metricsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const observability = getObservabilityService();

  // Get metrics in Prometheus format
  const prometheusMetrics = observability.metrics.getPrometheusMetrics();

  // Return as plain text with Prometheus content type
  reply
    .type('text/plain; version=0.0.4; charset=utf-8')
    .send(prometheusMetrics);
}

/**
 * GET /metrics/json - JSON metrics endpoint (for debugging)
 *
 * Returns metrics as JSON for easier inspection.
 * Also protected - internal use only.
 */
export async function metricsJsonHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const observability = getObservabilityService();

  // Get metrics as JSON
  const metricsJson = observability.metrics.getMetricsJson();

  reply.send(metricsJson);
}

/**
 * GET /health/observability - Health check for observability system
 *
 * Returns health status of all observability components.
 */
export async function observabilityHealthHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const observability = getObservabilityService();

  const health = observability.getHealth();

  reply.send(health);
}

/**
 * GET /audit/events - Audit events endpoint (admin only)
 *
 * Returns recent audit events for inspection.
 * Query params:
 * - eventType: Filter by event type
 * - userId: Filter by user ID
 * - since: ISO timestamp
 * - limit: Max number of events (default 100)
 */
export async function auditEventsHandler(
  request: FastifyRequest<{
    Querystring: {
      eventType?: string;
      userId?: string;
      since?: string;
      limit?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  const observability = getObservabilityService();

  const { eventType, userId, since, limit } = request.query;

  const filter: any = {};

  if (eventType) {
    filter.eventType = eventType;
  }

  if (userId) {
    filter.userId = userId;
  }

  if (since) {
    filter.since = new Date(since);
  }

  if (limit) {
    filter.limit = parseInt(limit, 10);
  } else {
    filter.limit = 100; // Default limit
  }

  const events = observability.audit.getEvents(filter);

  reply.send({
    events,
    count: events.length,
    filter,
  });
}

/**
 * GET /audit/statistics - Audit statistics endpoint (admin only)
 *
 * Returns aggregate statistics about audit events.
 */
export async function auditStatisticsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const observability = getObservabilityService();

  const statistics = observability.audit.getStatistics();

  reply.send(statistics);
}

/**
 * GET /usage/events - Usage events endpoint (admin only)
 *
 * Returns recent usage events for inspection.
 * Query params:
 * - userId: Filter by user ID
 * - endpoint: Filter by endpoint
 * - since: ISO timestamp
 * - until: ISO timestamp
 * - limit: Max number of events (default 100)
 */
export async function usageEventsHandler(
  request: FastifyRequest<{
    Querystring: {
      userId?: string;
      endpoint?: string;
      since?: string;
      until?: string;
      limit?: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  const observability = getObservabilityService();

  const { userId, endpoint, since, until, limit } = request.query;

  const filter: any = {};

  if (userId) {
    filter.userId = userId;
  }

  if (endpoint) {
    filter.endpoint = endpoint;
  }

  if (since) {
    filter.since = new Date(since);
  }

  if (until) {
    filter.until = new Date(until);
  }

  if (limit) {
    filter.limit = parseInt(limit, 10);
  } else {
    filter.limit = 100; // Default limit
  }

  const events = observability.usage.getEvents(filter);

  reply.send({
    events,
    count: events.length,
    filter,
  });
}

/**
 * GET /usage/export - Export usage events (admin only)
 *
 * Exports all usage events in CSV or JSONL format.
 * Query params:
 * - format: 'csv' or 'jsonl' (default: jsonl)
 */
export async function usageExportHandler(
  request: FastifyRequest<{
    Querystring: {
      format?: 'csv' | 'jsonl';
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  const observability = getObservabilityService();

  const format = request.query.format || 'jsonl';

  if (format === 'csv') {
    const csv = observability.usage.exportToCsv();
    reply
      .type('text/csv')
      .header('Content-Disposition', 'attachment; filename=usage-events.csv')
      .send(csv);
  } else {
    const jsonl = observability.usage.exportToJsonLines();
    reply
      .type('application/x-ndjson')
      .header('Content-Disposition', 'attachment; filename=usage-events.jsonl')
      .send(jsonl);
  }
}

/**
 * Register all observability routes on a Fastify instance
 *
 * All routes should be protected by admin scope or IP whitelist.
 */
export function registerObservabilityRoutes(app: any): void {
  // Metrics endpoints
  app.get('/metrics', metricsHandler);
  app.get('/metrics/json', metricsJsonHandler);

  // Health endpoint
  app.get('/health/observability', observabilityHealthHandler);

  // Audit endpoints (admin only)
  app.get('/audit/events', auditEventsHandler);
  app.get('/audit/statistics', auditStatisticsHandler);

  // Usage endpoints (admin only)
  app.get('/usage/events', usageEventsHandler);
  app.get('/usage/export', usageExportHandler);
}
