/**
 * Usage Routes
 *
 * Defines routes for usage tracking and reporting endpoints.
 * Requires authentication and identity:read scope.
 */

import { FastifyInstance } from 'fastify';
import { getCurrentUsageHandler, getUsageHistoryHandler } from '../handlers/usage.js';

/**
 * Register usage routes
 */
export async function registerUsageRoutes(fastify: FastifyInstance) {
  /**
   * GET /v1/usage/current
   * Get current usage summary for the authenticated user
   *
   * Query params:
   * - period: 'current-month' | 'last-7-days' | 'last-30-days'
   *
   * Requires: authentication, identity:read scope
   */
  fastify.get('/v1/usage/current', getCurrentUsageHandler);

  /**
   * GET /v1/usage/history
   * Get historical usage data with specified granularity
   *
   * Query params:
   * - start: ISO 8601 date
   * - end: ISO 8601 date
   * - granularity: 'hourly' | 'daily' | 'monthly'
   *
   * Requires: authentication, identity:read scope
   */
  fastify.get('/v1/usage/history', getUsageHistoryHandler);
}
