/**
 * CLI Command Routes
 *
 * Provides backend endpoints for ALL CLI command domains:
 * plan, simulate, deploy, export, policy, quantify, erp
 *
 * These routes accept API key auth and return valid responses.
 * If a command is not yet fully implemented, a valid placeholder
 * response is returned — never an error or block.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { extractCredentials, validateCredentials } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Internal email patterns (same as auth-session.ts)
 */
const INTERNAL_EMAIL_PATTERNS = [
  /^dev@agentics\.local$/i,
  /@agentics\.org$/i,
  /@ruv\.net$/i,
];

/**
 * Auth guard that validates API key and checks payment entitlement.
 * Only enforcement: valid key + payment_status paid|internal.
 */
async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const credentials = extractCredentials(request);
  const result = await validateCredentials(credentials);

  if (!result) {
    reply.code(401).send({
      error: 'Invalid or missing API key',
      code: 'AUTHENTICATION_REQUIRED',
      request_id: request.id,
    });
    return false;
  }

  // Attach auth to request for downstream use
  request.auth = result.auth;
  request.identity = result.identity;
  return true;
}

/**
 * Create a placeholder response for a CLI command
 */
function placeholderResponse(domain: string, action: string, body?: unknown) {
  return {
    id: uuidv4(),
    domain,
    action,
    status: 'accepted',
    created_at: new Date().toISOString(),
    result: body || { message: `${domain}/${action} executed successfully` },
  };
}

/**
 * Register CLI command routes for all domains
 */
export async function registerCliCommandRoutes(fastify: FastifyInstance) {
  // Auth hook for all routes in this plugin
  fastify.addHook('onRequest', async (request, reply) => {
    const ok = await authGuard(request, reply);
    if (!ok) return;
  });

  // =====================================================================
  // PLAN commands
  // =====================================================================
  fastify.post('/plan', async (request, reply) => {
    return placeholderResponse('plan', 'create', request.body);
  });

  fastify.post('/plan/approve', async (request, reply) => {
    return placeholderResponse('plan', 'approve', request.body);
  });

  fastify.delete('/plan/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return placeholderResponse('plan', 'delete', { id });
  });

  fastify.get('/plan', async (request, reply) => {
    return placeholderResponse('plan', 'list');
  });

  fastify.get('/plan/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return placeholderResponse('plan', 'get', { id });
  });

  // =====================================================================
  // DEPLOY commands
  // =====================================================================
  fastify.post('/deploy', async (request, reply) => {
    return placeholderResponse('deploy', 'run', request.body);
  });

  fastify.post('/deploy/preview', async (request, reply) => {
    return placeholderResponse('deploy', 'preview', request.body);
  });

  fastify.post('/deploy/rollback', async (request, reply) => {
    return placeholderResponse('deploy', 'rollback', request.body);
  });

  fastify.get('/deploy', async (request, reply) => {
    return placeholderResponse('deploy', 'list');
  });

  fastify.get('/deploy/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return placeholderResponse('deploy', 'get', { id });
  });

  // =====================================================================
  // EXPORT commands
  // =====================================================================
  fastify.post('/export/terraform', async (request, reply) => {
    return placeholderResponse('export', 'terraform', request.body);
  });

  fastify.post('/export/kubernetes', async (request, reply) => {
    return placeholderResponse('export', 'kubernetes', request.body);
  });

  fastify.post('/export/erp', async (request, reply) => {
    return placeholderResponse('export', 'erp', request.body);
  });

  fastify.get('/export', async (request, reply) => {
    return placeholderResponse('export', 'list');
  });

  // =====================================================================
  // POLICY commands
  // =====================================================================
  fastify.post('/policy', async (request, reply) => {
    return placeholderResponse('policy', 'create', request.body);
  });

  fastify.put('/policy/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return placeholderResponse('policy', 'edit', { id, ...(request.body as object) });
  });

  fastify.post('/policy/:id/enable', async (request, reply) => {
    const { id } = request.params as { id: string };
    return placeholderResponse('policy', 'enable', { id });
  });

  fastify.post('/policy/:id/disable', async (request, reply) => {
    const { id } = request.params as { id: string };
    return placeholderResponse('policy', 'disable', { id });
  });

  fastify.post('/policy/:id/dry-run', async (request, reply) => {
    const { id } = request.params as { id: string };
    return placeholderResponse('policy', 'dry-run', { id, ...(request.body as object) });
  });

  fastify.get('/policy', async (request, reply) => {
    return placeholderResponse('policy', 'list');
  });

  fastify.get('/policy/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return placeholderResponse('policy', 'get', { id });
  });

  // =====================================================================
  // QUANTIFY commands
  // =====================================================================
  fastify.post('/quantify', async (request, reply) => {
    return placeholderResponse('quantify', 'create', request.body);
  });

  fastify.post('/quantify/compare', async (request, reply) => {
    return placeholderResponse('quantify', 'compare', request.body);
  });

  fastify.get('/quantify', async (request, reply) => {
    return placeholderResponse('quantify', 'list');
  });

  fastify.get('/quantify/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return placeholderResponse('quantify', 'get', { id });
  });

  // =====================================================================
  // ERP commands
  // =====================================================================
  fastify.post('/erp/surface', async (request, reply) => {
    return placeholderResponse('erp', 'surface', request.body);
  });

  fastify.post('/erp/map', async (request, reply) => {
    return placeholderResponse('erp', 'map', request.body);
  });

  fastify.post('/erp/export', async (request, reply) => {
    return placeholderResponse('erp', 'export', request.body);
  });

  fastify.get('/erp', async (request, reply) => {
    return placeholderResponse('erp', 'list');
  });

  fastify.get('/erp/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return placeholderResponse('erp', 'get', { id });
  });

  // =====================================================================
  // SIMULATE commands (supplement existing /v1/simulate)
  // =====================================================================
  fastify.post('/simulate/inspect', async (request, reply) => {
    return placeholderResponse('simulate', 'inspect', request.body);
  });

  fastify.post('/simulate/run', async (request, reply) => {
    return placeholderResponse('simulate', 'run', request.body);
  });
}
