/**
 * Layer 3 Routes
 *
 * Registers ALL Layer 3 routed endpoints with Fastify.
 * All routes require authentication and apply scope requirements per SPARC.
 *
 * Routes are organized by Layer 3 core:
 * - Intelligence: /v1/intelligence/*
 * - Security: /v1/security/*
 * - Automation: /v1/automation/*
 * - Governance: /v1/governance/*
 * - Data: /v1/data/*
 * - Ecosystem: /v1/ecosystem/*
 * - Research: /v1/research/*
 * - Interface: /v1/interface/*
 */

import type { FastifyInstance } from 'fastify';

// Intelligence handlers
import {
  completionsHandler,
  embeddingsHandler,
  chatHandler,
  modelsHandler,
  chainsHandler,
} from '../handlers/intelligence.js';

// Security handlers
import {
  scanHandler,
  threatsHandler,
  auditHandler,
  policiesHandler as securityPoliciesHandler,
  evaluateHandler,
} from '../handlers/security.js';

// Automation handlers
import {
  createWorkflowHandler,
  getWorkflowHandler,
  triggerWorkflowHandler,
  getJobsHandler,
  createScheduleHandler,
} from '../handlers/automation.js';

// Governance handlers
import {
  validateHandler,
  policiesHandler as governancePoliciesHandler,
  approvalsHandler,
  complianceHandler,
  assessHandler,
} from '../handlers/governance.js';

// Data handlers
import {
  ingestHandler,
  getQueryHandler,
  postQueryHandler,
  catalogHandler,
  transformHandler,
  lineageHandler,
} from '../handlers/data.js';

// Ecosystem handlers
import {
  integrationsHandler,
  connectHandler,
  marketplaceHandler,
  webhooksHandler,
  pluginsHandler,
} from '../handlers/ecosystem.js';

// Research handlers
import {
  createSimulationHandler,
  getSimulationHandler,
  createExperimentHandler,
  getResultsHandler,
  createHypothesisHandler,
} from '../handlers/research.js';

// Interface handlers
import {
  createConversationHandler,
  getConversationHandler,
  createMessageHandler,
  getSessionsHandler,
  formatHandler,
} from '../handlers/interface.js';

/**
 * Register all Layer 3 routes
 * Auth middleware should be applied before calling this function
 */
export async function registerLayer3Routes(fastify: FastifyInstance): Promise<void> {
  // ========================================
  // Intelligence Routes
  // ========================================
  fastify.post('/v1/intelligence/completions', completionsHandler);
  fastify.post('/v1/intelligence/embeddings', embeddingsHandler);
  fastify.post('/v1/intelligence/chat', chatHandler);
  fastify.get('/v1/intelligence/models', modelsHandler);
  fastify.post('/v1/intelligence/chains', chainsHandler);

  // ========================================
  // Security Routes
  // ========================================
  fastify.post('/v1/security/scan', scanHandler);
  fastify.get('/v1/security/threats', threatsHandler);
  fastify.post('/v1/security/audit', auditHandler);
  fastify.get('/v1/security/policies', securityPoliciesHandler);
  fastify.post('/v1/security/evaluate', evaluateHandler);

  // ========================================
  // Automation Routes
  // ========================================
  fastify.post('/v1/automation/workflows', createWorkflowHandler);
  fastify.get('/v1/automation/workflows/:id', getWorkflowHandler);
  fastify.post('/v1/automation/workflows/:id/trigger', triggerWorkflowHandler);
  fastify.get('/v1/automation/jobs', getJobsHandler);
  fastify.post('/v1/automation/schedules', createScheduleHandler);

  // ========================================
  // Governance Routes
  // ========================================
  fastify.post('/v1/governance/validate', validateHandler);
  fastify.get('/v1/governance/policies', governancePoliciesHandler);
  fastify.post('/v1/governance/approvals', approvalsHandler);
  fastify.get('/v1/governance/compliance', complianceHandler);
  fastify.post('/v1/governance/assess', assessHandler);

  // ========================================
  // Data Routes
  // ========================================
  fastify.post('/v1/data/ingest', ingestHandler);
  fastify.get('/v1/data/query', getQueryHandler);
  fastify.post('/v1/data/query', postQueryHandler);
  fastify.get('/v1/data/catalog', catalogHandler);
  fastify.post('/v1/data/transform', transformHandler);
  fastify.get('/v1/data/lineage', lineageHandler);

  // ========================================
  // Ecosystem Routes
  // ========================================
  fastify.get('/v1/ecosystem/integrations', integrationsHandler);
  fastify.post('/v1/ecosystem/connect', connectHandler);
  fastify.get('/v1/ecosystem/marketplace', marketplaceHandler);
  fastify.post('/v1/ecosystem/webhooks', webhooksHandler);
  fastify.get('/v1/ecosystem/plugins', pluginsHandler);

  // ========================================
  // Research Routes
  // ========================================
  fastify.post('/v1/research/simulations', createSimulationHandler);
  fastify.get('/v1/research/simulations/:id', getSimulationHandler);
  fastify.post('/v1/research/experiments', createExperimentHandler);
  fastify.get('/v1/research/results', getResultsHandler);
  fastify.post('/v1/research/hypotheses', createHypothesisHandler);

  // ========================================
  // Interface Routes
  // ========================================
  fastify.post('/v1/interface/conversations', createConversationHandler);
  fastify.get('/v1/interface/conversations/:id', getConversationHandler);
  fastify.post('/v1/interface/conversations/:id/messages', createMessageHandler);
  fastify.get('/v1/interface/sessions', getSessionsHandler);
  fastify.post('/v1/interface/format', formatHandler);
}
