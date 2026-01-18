/**
 * Usage Proxy Routes
 *
 * Exposes backend usage-ledger aggregation endpoints to the frontend UI.
 * These routes proxy authenticated requests to agentics-usage-ledger.
 *
 * Constraints:
 * - Does NOT re-compute usage data
 * - Does NOT store usage locally
 * - Does NOT accept org_id from the UI (derived from auth context)
 * - Preserves Cloud Run identity
 * - Passes through query parameters (date ranges)
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import {
  getUsageSummaryHandler,
  getUsageByCommandHandler,
  getUsageByDayHandler,
  getUsageByUserHandler,
} from '../handlers/usage-proxy.js';

/**
 * Register usage proxy routes
 *
 * Routes:
 * - GET /api/usage/summary - Aggregated usage summary
 * - GET /api/usage/by-command - Usage breakdown by command
 * - GET /api/usage/by-day - Usage breakdown by day
 * - GET /api/usage/by-user - Usage breakdown by user (for org admins)
 *
 * Query Parameters (passed through to ledger):
 * - start_date: ISO 8601 date (optional)
 * - end_date: ISO 8601 date (optional)
 */
export async function registerUsageProxyRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/usage/summary
   * Get aggregated usage summary for the authenticated organization
   */
  fastify.get('/api/usage/summary', {
    onRequest: [authMiddleware],
    handler: getUsageSummaryHandler,
  });

  /**
   * GET /api/usage/by-command
   * Get usage breakdown by command for the authenticated organization
   */
  fastify.get('/api/usage/by-command', {
    onRequest: [authMiddleware],
    handler: getUsageByCommandHandler,
  });

  /**
   * GET /api/usage/by-day
   * Get usage breakdown by day for the authenticated organization
   */
  fastify.get('/api/usage/by-day', {
    onRequest: [authMiddleware],
    handler: getUsageByDayHandler,
  });

  /**
   * GET /api/usage/by-user
   * Get usage breakdown by user for the authenticated organization
   */
  fastify.get('/api/usage/by-user', {
    onRequest: [authMiddleware],
    handler: getUsageByUserHandler,
  });
}
