/**
 * Usage Handlers
 *
 * HTTP handlers for usage tracking and reporting endpoints.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { entitlementService } from '../services/entitlements/index.js';

/**
 * Request types
 */
interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: string;
    identityId?: string;
    scopes?: string[];
  };
}

interface UsageCurrentQuery {
  period?: 'current-month' | 'last-7-days' | 'last-30-days';
}

interface UsageHistoryQuery {
  start: string; // ISO 8601 date
  end: string; // ISO 8601 date
  granularity?: 'hourly' | 'daily' | 'monthly';
}

/**
 * GET /v1/usage/current
 *
 * Get current usage summary for the authenticated user
 */
export async function getCurrentUsageHandler(
  request: FastifyRequest<{ Querystring: UsageCurrentQuery }>,
  reply: FastifyReply
) {
  const authRequest = request as AuthenticatedRequest;

  // Check authentication
  if (!authRequest.user?.userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authRequest.user.userId;
  const period = request.query.period || 'current-month';

  try {
    // Calculate period dates
    let start: Date;
    let end: Date;
    const now = new Date();

    switch (period) {
      case 'current-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;

      case 'last-7-days':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = now;
        break;

      case 'last-30-days':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        end = now;
        break;

      default:
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid period. Must be one of: current-month, last-7-days, last-30-days',
        });
    }

    // Get usage summary
    const summary = await entitlementService.getUsageSummary(userId, { start, end });

    // Get entitlement info
    const entitlement = await entitlementService.lookupEntitlements(userId);

    return reply.status(200).send({
      success: true,
      data: {
        userId,
        tier: entitlement.tier,
        period: {
          type: period,
          start: summary.period.start.toISOString(),
          end: summary.period.end.toISOString(),
        },
        usage: {
          requests: {
            total: summary.requests.total,
            byEndpoint: summary.requests.byEndpoint,
          },
          tokens: {
            total: summary.tokens.total,
            byEndpoint: summary.tokens.byEndpoint,
          },
        },
        quota: {
          requests: {
            used: summary.quotaStatus.requestsUsed,
            limit: summary.quotaStatus.requestsLimit,
            remaining: summary.quotaStatus.requestsRemaining,
            percentUsed:
              summary.quotaStatus.requestsLimit !== null
                ? Math.round(
                    (summary.quotaStatus.requestsUsed / summary.quotaStatus.requestsLimit) * 100
                  )
                : null,
          },
          tokens: {
            used: summary.quotaStatus.tokensUsed,
            limit: summary.quotaStatus.tokensLimit,
            remaining: summary.quotaStatus.tokensRemaining,
            percentUsed:
              summary.quotaStatus.tokensLimit !== null
                ? Math.round(
                    (summary.quotaStatus.tokensUsed / summary.quotaStatus.tokensLimit) * 100
                  )
                : null,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching current usage:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to fetch usage data',
    });
  }
}

/**
 * GET /v1/usage/history
 *
 * Get historical usage data with specified granularity
 */
export async function getUsageHistoryHandler(
  request: FastifyRequest<{ Querystring: UsageHistoryQuery }>,
  reply: FastifyReply
) {
  const authRequest = request as AuthenticatedRequest;

  // Check authentication
  if (!authRequest.user?.userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authRequest.user.userId;
  const { start, end, granularity = 'daily' } = request.query;

  // Validate required parameters
  if (!start || !end) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Both start and end date parameters are required (ISO 8601 format)',
    });
  }

  // Validate granularity
  if (!['hourly', 'daily', 'monthly'].includes(granularity)) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Invalid granularity. Must be one of: hourly, daily, monthly',
    });
  }

  try {
    // Parse dates
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid date format. Dates must be in ISO 8601 format',
      });
    }

    if (startDate >= endDate) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Start date must be before end date',
      });
    }

    // Get usage history
    const history = await entitlementService.getUsageHistory(
      userId,
      startDate,
      endDate,
      granularity
    );

    // Format data points for response
    const dataPoints = history.dataPoints.map((point) => ({
      timestamp: point.timestamp.toISOString(),
      requests: point.requests,
      tokens: point.tokens,
      endpointBreakdown: point.endpointBreakdown,
    }));

    return reply.status(200).send({
      success: true,
      data: {
        userId,
        granularity: history.granularity,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        dataPoints,
        summary: {
          totalRequests: dataPoints.reduce((sum, p) => sum + p.requests, 0),
          totalTokens: dataPoints.reduce((sum, p) => sum + p.tokens, 0),
          dataPointCount: dataPoints.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching usage history:', error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to fetch usage history',
    });
  }
}
