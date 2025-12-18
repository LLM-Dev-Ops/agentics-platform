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
  fastify.post('/v1/intelligence/completions', {
    schema: {
      description: 'Generate text completions using LLM models',
      tags: ['intelligence'],
    },
    handler: completionsHandler,
  });

  fastify.post('/v1/intelligence/embeddings', {
    schema: {
      description: 'Generate vector embeddings for text',
      tags: ['intelligence'],
    },
    handler: embeddingsHandler,
  });

  fastify.post('/v1/intelligence/chat', {
    schema: {
      description: 'Multi-turn chat conversations',
      tags: ['intelligence'],
    },
    handler: chatHandler,
  });

  fastify.get('/v1/intelligence/models', {
    schema: {
      description: 'List available models',
      tags: ['intelligence'],
    },
    handler: modelsHandler,
  });

  fastify.post('/v1/intelligence/chains', {
    schema: {
      description: 'Execute chain-of-thought workflows',
      tags: ['intelligence'],
    },
    handler: chainsHandler,
  });

  // ========================================
  // Security Routes
  // ========================================
  fastify.post('/v1/security/scan', {
    schema: {
      description: 'Execute security scans on targets',
      tags: ['security'],
    },
    handler: scanHandler,
  });

  fastify.get('/v1/security/threats', {
    schema: {
      description: 'Retrieve detected security threats',
      tags: ['security'],
    },
    handler: threatsHandler,
  });

  fastify.post('/v1/security/audit', {
    schema: {
      description: 'Create audit log entries',
      tags: ['security'],
    },
    handler: auditHandler,
  });

  fastify.get('/v1/security/policies', {
    schema: {
      description: 'List security policies',
      tags: ['security'],
    },
    handler: securityPoliciesHandler,
  });

  fastify.post('/v1/security/evaluate', {
    schema: {
      description: 'Evaluate content against security policies',
      tags: ['security'],
    },
    handler: evaluateHandler,
  });

  // ========================================
  // Automation Routes
  // ========================================
  fastify.post('/v1/automation/workflows', {
    schema: {
      description: 'Create a new workflow',
      tags: ['automation'],
    },
    handler: createWorkflowHandler,
  });

  fastify.get('/v1/automation/workflows/:id', {
    schema: {
      description: 'Get workflow details',
      tags: ['automation'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    handler: getWorkflowHandler,
  });

  fastify.post('/v1/automation/workflows/:id/trigger', {
    schema: {
      description: 'Trigger workflow execution',
      tags: ['automation'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    handler: triggerWorkflowHandler,
  });

  fastify.get('/v1/automation/jobs', {
    schema: {
      description: 'List automation jobs',
      tags: ['automation'],
    },
    handler: getJobsHandler,
  });

  fastify.post('/v1/automation/schedules', {
    schema: {
      description: 'Create a new schedule',
      tags: ['automation'],
    },
    handler: createScheduleHandler,
  });

  // ========================================
  // Governance Routes
  // ========================================
  fastify.post('/v1/governance/validate', {
    schema: {
      description: 'Validate resources against governance policies',
      tags: ['governance'],
    },
    handler: validateHandler,
  });

  fastify.get('/v1/governance/policies', {
    schema: {
      description: 'List governance policies',
      tags: ['governance'],
    },
    handler: governancePoliciesHandler,
  });

  fastify.post('/v1/governance/approvals', {
    schema: {
      description: 'Create approval workflow',
      tags: ['governance'],
    },
    handler: approvalsHandler,
  });

  fastify.get('/v1/governance/compliance', {
    schema: {
      description: 'Get compliance status and reports',
      tags: ['governance'],
    },
    handler: complianceHandler,
  });

  fastify.post('/v1/governance/assess', {
    schema: {
      description: 'Assess resources for governance compliance',
      tags: ['governance'],
    },
    handler: assessHandler,
  });

  // ========================================
  // Data Routes
  // ========================================
  fastify.post('/v1/data/ingest', {
    schema: {
      description: 'Ingest data into the platform',
      tags: ['data'],
    },
    handler: ingestHandler,
  });

  // Note: SPARC shows POST /v1/data/query in one place and GET in another
  // We implement both as requested
  fastify.get('/v1/data/query', {
    schema: {
      description: 'Query data (GET method for simple queries)',
      tags: ['data'],
    },
    handler: getQueryHandler,
  });

  fastify.post('/v1/data/query', {
    schema: {
      description: 'Query data (POST method for complex queries)',
      tags: ['data'],
    },
    handler: postQueryHandler,
  });

  fastify.get('/v1/data/catalog', {
    schema: {
      description: 'Get data catalog',
      tags: ['data'],
    },
    handler: catalogHandler,
  });

  fastify.post('/v1/data/transform', {
    schema: {
      description: 'Transform data',
      tags: ['data'],
    },
    handler: transformHandler,
  });

  fastify.get('/v1/data/lineage', {
    schema: {
      description: 'Get data lineage information',
      tags: ['data'],
    },
    handler: lineageHandler,
  });

  // ========================================
  // Ecosystem Routes
  // ========================================
  fastify.get('/v1/ecosystem/integrations', {
    schema: {
      description: 'List available integrations',
      tags: ['ecosystem'],
    },
    handler: integrationsHandler,
  });

  fastify.post('/v1/ecosystem/connect', {
    schema: {
      description: 'Connect to an external integration',
      tags: ['ecosystem'],
    },
    handler: connectHandler,
  });

  fastify.get('/v1/ecosystem/marketplace', {
    schema: {
      description: 'Browse marketplace items',
      tags: ['ecosystem'],
    },
    handler: marketplaceHandler,
  });

  fastify.post('/v1/ecosystem/webhooks', {
    schema: {
      description: 'Create a new webhook',
      tags: ['ecosystem'],
    },
    handler: webhooksHandler,
  });

  fastify.get('/v1/ecosystem/plugins', {
    schema: {
      description: 'List available plugins',
      tags: ['ecosystem'],
    },
    handler: pluginsHandler,
  });

  // ========================================
  // Research Routes
  // ========================================
  fastify.post('/v1/research/simulations', {
    schema: {
      description: 'Create and run a simulation',
      tags: ['research'],
    },
    handler: createSimulationHandler,
  });

  fastify.get('/v1/research/simulations/:id', {
    schema: {
      description: 'Get simulation status and results',
      tags: ['research'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    handler: getSimulationHandler,
  });

  fastify.post('/v1/research/experiments', {
    schema: {
      description: 'Create a new experiment',
      tags: ['research'],
    },
    handler: createExperimentHandler,
  });

  fastify.get('/v1/research/results', {
    schema: {
      description: 'Get research results',
      tags: ['research'],
    },
    handler: getResultsHandler,
  });

  fastify.post('/v1/research/hypotheses', {
    schema: {
      description: 'Create a new hypothesis',
      tags: ['research'],
    },
    handler: createHypothesisHandler,
  });

  // ========================================
  // Interface Routes
  // ========================================
  fastify.post('/v1/interface/conversations', {
    schema: {
      description: 'Create a new conversation',
      tags: ['interface'],
    },
    handler: createConversationHandler,
  });

  fastify.get('/v1/interface/conversations/:id', {
    schema: {
      description: 'Get conversation details',
      tags: ['interface'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    handler: getConversationHandler,
  });

  fastify.post('/v1/interface/conversations/:id/messages', {
    schema: {
      description: 'Add a message to a conversation',
      tags: ['interface'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    handler: createMessageHandler,
  });

  fastify.get('/v1/interface/sessions', {
    schema: {
      description: 'List user sessions',
      tags: ['interface'],
    },
    handler: getSessionsHandler,
  });

  fastify.post('/v1/interface/format', {
    schema: {
      description: 'Format content for different output types',
      tags: ['interface'],
    },
    handler: formatHandler,
  });
}
