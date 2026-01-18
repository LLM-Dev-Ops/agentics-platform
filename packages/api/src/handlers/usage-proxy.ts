/**
 * Usage Proxy Handlers
 *
 * Proxies usage requests to the agentics-usage-ledger service.
 * Does NOT re-compute or store usage data - pure pass-through proxy.
 * org_id is derived from auth context, NEVER from UI input.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import config from '../config.js';

/**
 * Common query parameters for usage endpoints
 */
interface UsageQueryParams {
  start_date?: string;
  end_date?: string;
}

/**
 * Forward request to usage ledger with org_id from auth context
 */
async function proxyToUsageLedger(
  request: FastifyRequest,
  reply: FastifyReply,
  endpoint: string
): Promise<void> {
  // Get org_id from auth context - NEVER from UI
  const orgId = request.auth?.org_id;

  if (!orgId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
      request_id: request.id,
    });
  }

  // Build upstream URL with org_id and query params
  const url = new URL(`${config.usageLedgerUrl}${endpoint}`);
  url.searchParams.set('org_id', orgId);

  // Pass through query parameters (date ranges, etc.)
  const query = request.query as UsageQueryParams;
  if (query.start_date) {
    url.searchParams.set('start_date', query.start_date);
  }
  if (query.end_date) {
    url.searchParams.set('end_date', query.end_date);
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': request.id,
        'X-Org-Id': orgId,
      },
    });

    const contentType = response.headers.get('content-type') || '';

    // Forward response status and headers
    reply.status(response.status);

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return reply.send(data);
    } else {
      const text = await response.text();
      return reply.send(text);
    }
  } catch (error) {
    request.log.error({ error, endpoint }, 'Failed to proxy to usage ledger');
    return reply.status(502).send({
      error: 'Bad Gateway',
      code: 'USAGE_LEDGER_ERROR',
      message: 'Failed to fetch usage data from ledger service',
      request_id: request.id,
    });
  }
}

/**
 * GET /api/usage/summary
 * Proxies to usage ledger summary endpoint
 */
export async function getUsageSummaryHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  return proxyToUsageLedger(request, reply, '/v1/usage/summary');
}

/**
 * GET /api/usage/by-command
 * Proxies to usage ledger by-command endpoint
 */
export async function getUsageByCommandHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  return proxyToUsageLedger(request, reply, '/v1/usage/by-command');
}

/**
 * GET /api/usage/by-day
 * Proxies to usage ledger by-day endpoint
 */
export async function getUsageByDayHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  return proxyToUsageLedger(request, reply, '/v1/usage/by-day');
}

/**
 * GET /api/usage/by-user
 * Proxies to usage ledger by-user endpoint
 */
export async function getUsageByUserHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  return proxyToUsageLedger(request, reply, '/v1/usage/by-user');
}
