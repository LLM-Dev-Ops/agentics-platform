/**
 * Scope Validation Middleware
 * Checks if authenticated request has required scope for endpoint access
 *
 * Routes declare required scopes.
 * If key lacks required scope → HTTP 403.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthContext, Identity } from './auth.js';

export interface ScopeCheckResult {
  authorized: boolean;
  requiredScope: string;
  userScopes: string[];
}

/**
 * Map endpoint patterns to required scopes
 * Implements SPARC getRequiredScope pseudocode
 */
export function getRequiredScope(endpoint: string): string | null {
  const scopeMap: Record<string, string | null> = {
    // Identity endpoints
    'POST /v1/identity/authenticate': null, // No auth required for login
    'POST /v1/identity/api-keys': 'identity:write',
    'GET /v1/identity/whoami': 'identity:read',
    'DELETE /v1/identity/api-keys/*': 'identity:write',

    // Usage endpoints
    'GET /v1/usage/current': 'identity:read',
    'GET /v1/usage/history': 'identity:read',

    // Intelligence endpoints
    'POST /v1/intelligence/completions': 'intelligence:write',
    'POST /v1/intelligence/embeddings': 'intelligence:write',
    'POST /v1/intelligence/chat': 'intelligence:write',
    'GET /v1/intelligence/models': 'intelligence:read',
    'POST /v1/intelligence/chains': 'intelligence:write',

    // Security endpoints
    'POST /v1/security/scan': 'security:write',
    'GET /v1/security/threats': 'security:read',
    'POST /v1/security/audit': 'security:write',
    'GET /v1/security/policies': 'security:read',
    'POST /v1/security/evaluate': 'security:write',

    // Automation endpoints
    'POST /v1/automation/workflows': 'automation:write',
    'GET /v1/automation/workflows': 'automation:read',
    'GET /v1/automation/workflows/*': 'automation:read',
    'POST /v1/automation/workflows/*/trigger': 'automation:write',
    'GET /v1/automation/jobs': 'automation:read',
    'POST /v1/automation/schedules': 'automation:write',

    // Governance endpoints
    'POST /v1/governance/validate': 'governance:write',
    'GET /v1/governance/policies': 'governance:read',
    'POST /v1/governance/approvals': 'governance:write',
    'GET /v1/governance/compliance': 'governance:read',
    'POST /v1/governance/assess': 'governance:write',

    // Data endpoints
    'POST /v1/data/ingest': 'data:write',
    'POST /v1/data/query': 'data:read',
    'GET /v1/data/catalog': 'data:read',
    'POST /v1/data/transform': 'data:write',
    'GET /v1/data/lineage': 'data:read',

    // Ecosystem endpoints
    'GET /v1/ecosystem/integrations': 'ecosystem:read',
    'POST /v1/ecosystem/connect': 'ecosystem:write',
    'GET /v1/ecosystem/marketplace': 'ecosystem:read',
    'POST /v1/ecosystem/webhooks': 'ecosystem:write',
    'GET /v1/ecosystem/plugins': 'ecosystem:read',

    // Research endpoints
    'POST /v1/research/simulations': 'research:write',
    'GET /v1/research/simulations/*': 'research:read',
    'POST /v1/research/experiments': 'research:write',
    'GET /v1/research/results': 'research:read',
    'POST /v1/research/hypotheses': 'research:write',

    // Interface endpoints
    'POST /v1/interface/conversations': 'intelligence:write',
    'GET /v1/interface/conversations/*': 'intelligence:read',
    'POST /v1/interface/conversations/*/messages': 'intelligence:write',
    'GET /v1/interface/sessions': 'intelligence:read',
    'POST /v1/interface/format': 'intelligence:write',

    // Simulation endpoint (unified)
    'POST /v1/simulate': 'research:write',
    'GET /v1/simulate/*': 'research:read',
  };

  // Exact match first
  const key = `${endpoint}`;
  if (scopeMap[key] !== undefined) {
    return scopeMap[key];
  }

  // Pattern matching for wildcard routes
  for (const [pattern, scope] of Object.entries(scopeMap)) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '[^/]+') + '$');
      if (regex.test(endpoint)) {
        return scope;
      }
    }
  }

  // Default: require read access for GET, write access for others
  if (endpoint.includes('/v1/')) {
    const method = endpoint.split(' ')[0];
    const path = endpoint.split(' ')[1];
    const domain = path.split('/')[2]; // e.g., 'intelligence' from '/v1/intelligence/...'

    if (method === 'GET') {
      return `${domain}:read`;
    } else {
      return `${domain}:write`;
    }
  }

  return null;
}

/**
 * Entity with scopes (AuthContext or Identity)
 */
interface HasScopes {
  scopes: string[];
}

/**
 * Check if auth context or identity has required scope
 * Implements SPARC hasScope pseudocode
 */
export function hasScope(auth: HasScopes, requiredScope: string | null): boolean {
  // No scope required
  if (!requiredScope) {
    return true;
  }

  // Check for admin:* scope (grants all access)
  if (auth.scopes.includes('admin:*')) {
    return true;
  }

  // Check for exact scope match
  if (auth.scopes.includes(requiredScope)) {
    return true;
  }

  // Check for wildcard scope (e.g., intelligence:* grants intelligence:read and intelligence:write)
  const [domain, action] = requiredScope.split(':');
  if (auth.scopes.includes(`${domain}:*`)) {
    return true;
  }

  return false;
}

/**
 * Create a scope checking function for a specific required scope
 * Usage: const requireAdmin = requireScope('admin:*');
 */
export function requireScope(requiredScope: string) {
  return function checkScope(auth: HasScopes): boolean {
    return hasScope(auth, requiredScope);
  };
}

/**
 * Scope validation middleware for Fastify
 * Uses request.auth (preferred) or request.identity for scope checking
 */
export async function scopeMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const auth = request.auth;

  if (!auth) {
    // No auth context means auth middleware should have rejected
    reply.status(401).send({
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
      request_id: request.id,
    });
    return;
  }

  // Construct endpoint key from method and path
  const endpoint = `${request.method} ${request.url.split('?')[0]}`;
  const requiredScope = getRequiredScope(endpoint);

  if (!hasScope(auth, requiredScope)) {
    reply.status(403).send({
      error: 'Insufficient permissions',
      code: 'AUTHORIZATION_DENIED',
      request_id: request.id,
      details: {
        requiredScope,
        keyScopes: auth.scopes,
      },
    });
    return;
  }
}

/**
 * Get scope check result without throwing
 * Useful for testing and diagnostics
 */
export function checkScope(auth: HasScopes, endpoint: string): ScopeCheckResult {
  const requiredScope = getRequiredScope(endpoint);
  const authorized = hasScope(auth, requiredScope);

  return {
    authorized,
    requiredScope: requiredScope || 'none',
    userScopes: auth.scopes,
  };
}
