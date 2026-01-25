/**
 * Agent HTTP Routes
 *
 * HTTP handlers for Cloud Run deployment.
 * Exposes REST endpoints for agent invocation.
 *
 * @module @agentics/agents/server/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createRiskScoringAgent, RISK_SCORING_AGENT_CONTRACT } from '../risk-scoring/index.js';
import type { RiskScoringAgentInput } from '../risk-scoring/index.js';
import { createDecisionAgent, DECISION_AGENT_CONTRACT } from '../decision/index.js';
import { createAgentContext } from '../base/context.js';
import type { DecisionAgentInput } from '../decision/decision-agent.js';
import { RuvectorClient } from '@agentics/ruvector-client';

/**
 * Register all agent routes
 */
export async function registerAgentRoutes(
  server: FastifyInstance
): Promise<void> {
  // Risk Scoring Agent routes
  await registerRiskScoringRoutes(server);

  // Decision Agent routes
  await registerDecisionAgentRoutes(server);

  // Agent registry route
  server.get('/agents', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      agents: [
        {
          agent_id: 'risk-scoring-agent',
          agent_version: '0.1.0',
          name: 'Risk Scoring Agent',
          classification: RISK_SCORING_AGENT_CONTRACT.metadata.classification,
          decision_types: RISK_SCORING_AGENT_CONTRACT.metadata.decision_types,
          status: 'active',
        },
        {
          agent_id: 'decision-agent',
          agent_version: '0.1.0',
          name: 'Decision Agent',
          classification: DECISION_AGENT_CONTRACT.metadata.classification,
          decision_types: DECISION_AGENT_CONTRACT.metadata.decision_types,
          status: 'active',
        },
      ],
    });
  });

  // Health check
  server.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: 'healthy' });
  });

  // Ready check - STRICT mode for Apex layer
  server.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Check ruvector connectivity
    // For Apex agents, Ruvector is REQUIRED - not optional
    try {
      const ruvectorUrl = process.env.RUVECTOR_SERVICE_URL;
      const ruvectorKey = process.env.RUVECTOR_API_KEY;

      if (!ruvectorUrl || !ruvectorKey) {
        // In Apex layer, missing Ruvector config is a failure
        return reply.status(503).send({
          status: 'not_ready',
          ruvector: 'not_configured',
          error: 'RUVECTOR_SERVICE_URL and RUVECTOR_API_KEY are required for Apex agents',
          apex: {
            phase: process.env.AGENT_PHASE || 'apex',
            layer: process.env.AGENT_LAYER || 'layer5',
          },
        });
      }

      const client = new RuvectorClient({
        baseUrl: ruvectorUrl,
        apiKey: ruvectorKey,
      });

      // Perform health check
      await client.health();

      return reply.send({
        status: 'ready',
        ruvector: 'connected',
        apex: {
          phase: process.env.AGENT_PHASE || 'apex',
          layer: process.env.AGENT_LAYER || 'layer5',
          agent_name: process.env.AGENT_NAME || 'agentics-agents',
        },
      });
    } catch (error) {
      return reply.status(503).send({
        status: 'not_ready',
        ruvector: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        apex: {
          phase: process.env.AGENT_PHASE || 'apex',
          layer: process.env.AGENT_LAYER || 'layer5',
        },
      });
    }
  });
}

/**
 * Get validated agent configuration.
 * REQUIRES startup validation to have completed.
 */
function getAgentConfig(): {
  ruvector: { baseUrl: string; apiKey?: string };
  telemetry: { enabled: boolean; endpoint?: string };
} {
  const ruvectorUrl = process.env.RUVECTOR_SERVICE_URL;
  const ruvectorKey = process.env.RUVECTOR_API_KEY;

  // These should always be set after startup validation
  // If not, fail explicitly
  if (!ruvectorUrl) {
    throw new Error(
      'RUVECTOR_SERVICE_URL not configured. ' +
      'Startup validation should have caught this.'
    );
  }

  if (!ruvectorKey) {
    throw new Error(
      'RUVECTOR_API_KEY not configured. ' +
      'Startup validation should have caught this.'
    );
  }

  return {
    ruvector: {
      baseUrl: ruvectorUrl,
      apiKey: ruvectorKey,
    },
    telemetry: {
      enabled: true,
      endpoint: process.env.TELEMETRY_ENDPOINT,
    },
  };
}

/**
 * Register Risk Scoring Agent routes
 */
async function registerRiskScoringRoutes(
  server: FastifyInstance
): Promise<void> {

  /**
   * POST /risk-scoring/score
   * Execute risk scoring analysis
   */
  server.post('/risk-scoring/score', async (request: FastifyRequest<{ Body: RiskScoringAgentInput }>, reply: FastifyReply) => {
    const startTime = Date.now();
    const correlationId = request.headers['x-correlation-id'] as string;

    try {
      const agent = createRiskScoringAgent({
        ...getAgentConfig(),
        dryRun: request.headers['x-dry-run'] === 'true',
      });

      const context = createAgentContext({
        correlationId: correlationId || request.id as string,
        mode: 'cloud_run',
        source: 'agent-server',
      });

      const result = await agent.invoke(request.body, context);

      reply.header('X-Correlation-Id', context.correlationId);
      return reply.send(agent.createCliOutput(result, startTime));
    } catch (error) {
      return reply.status(500).send({
        success: false,
        errors: [{ code: 'AGENT_ERROR', message: (error as Error).message }],
        metadata: {
          execution_time_ms: Date.now() - startTime,
          agent_id: 'risk-scoring-agent',
          agent_version: '0.1.0',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * POST /risk-scoring/decide
   * Alias for score (for constitution compliance)
   */
  server.post('/risk-scoring/decide', async (request: FastifyRequest<{ Body: RiskScoringAgentInput }>, reply: FastifyReply) => {
    const startTime = Date.now();
    const correlationId = request.headers['x-correlation-id'] as string;

    try {
      const agent = createRiskScoringAgent({
        ...getAgentConfig(),
        dryRun: request.headers['x-dry-run'] === 'true',
      });

      const context = createAgentContext({
        correlationId: correlationId || request.id as string,
        mode: 'cloud_run',
        source: 'agent-server',
      });

      const result = await agent.invoke(request.body, context);

      reply.header('X-Correlation-Id', context.correlationId);
      return reply.send(agent.createCliOutput(result, startTime));
    } catch (error) {
      return reply.status(500).send({
        success: false,
        errors: [{ code: 'AGENT_ERROR', message: (error as Error).message }],
        metadata: {
          execution_time_ms: Date.now() - startTime,
          agent_id: 'risk-scoring-agent',
          agent_version: '0.1.0',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * GET /risk-scoring/inspect
   * Inspect agent status
   */
  server.get('/risk-scoring/inspect', async (_request: FastifyRequest, reply: FastifyReply) => {
    const agent = createRiskScoringAgent({
      ruvector: { baseUrl: 'http://localhost:8080' },
      dryRun: true,
    });

    return reply.send({
      agent_id: agent.agentId,
      agent_version: agent.agentVersion,
      decision_type: agent.decisionType,
      contract: agent.contract,
    });
  });

  /**
   * GET /risk-scoring/registration
   * Get agent registration metadata
   */
  server.get('/risk-scoring/registration', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      agent_id: 'risk-scoring-agent',
      agent_version: '0.1.0',
      name: 'Risk Scoring Agent',
      classification: RISK_SCORING_AGENT_CONTRACT.metadata.classification,
      decision_types: RISK_SCORING_AGENT_CONTRACT.metadata.decision_types,
      consumers: RISK_SCORING_AGENT_CONTRACT.consumers,
      boundaries: RISK_SCORING_AGENT_CONTRACT.boundaries,
    });
  });
}

/**
 * Register Decision Agent routes
 *
 * PROMPT 3 Implementation: Wire Decision Agent into platform
 *
 * APEX AGENTS:
 * - Decision Agent: Synthesizes DecisionEvents into recommendations
 * - These agents coordinate and synthesize, never execute
 */
async function registerDecisionAgentRoutes(
  server: FastifyInstance
): Promise<void> {

  /**
   * POST /decision/decide
   * Synthesize DecisionEvents into actionable recommendation
   */
  server.post('/decision/decide', async (request: FastifyRequest<{ Body: DecisionAgentInput }>, reply: FastifyReply) => {
    const startTime = Date.now();
    const correlationId = request.headers['x-correlation-id'] as string;

    try {
      const agent = createDecisionAgent({
        ...getAgentConfig(),
        dryRun: request.headers['x-dry-run'] === 'true',
      });

      const context = createAgentContext({
        correlationId: correlationId || request.id as string,
        mode: 'cloud_run',
        source: 'agent-server',
      });

      const result = await agent.invoke(request.body, context);

      reply.header('X-Correlation-Id', context.correlationId);
      return reply.send(agent.createCliOutput(result, startTime));
    } catch (error) {
      return reply.status(500).send({
        success: false,
        errors: [{ code: 'AGENT_ERROR', message: (error as Error).message }],
        metadata: {
          execution_time_ms: Date.now() - startTime,
          agent_id: 'decision-agent',
          agent_version: '0.1.0',
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * POST /decision/summarize
   * Generate decision summary
   */
  server.post('/decision/summarize', async (request: FastifyRequest<{ Body: DecisionAgentInput }>, reply: FastifyReply) => {
    const startTime = Date.now();

    try {
      const agent = createDecisionAgent({
        ...getAgentConfig(),
        dryRun: true, // Summarize doesn't persist
      });

      const context = createAgentContext({
        correlationId: request.headers['x-correlation-id'] as string || request.id as string,
        mode: 'cloud_run',
      });

      const result = await agent.invoke(request.body, context);

      return reply.send({
        summary: result.summary,
        confidence: result.event.confidence,
        risk_level: result.event.outputs.risk_level,
        events_processed: result.event.outputs.data?.events_processed,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          agent_id: agent.agentId,
          agent_version: agent.agentVersion,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      return reply.status(500).send({ error: (error as Error).message });
    }
  });

  /**
   * POST /decision/score
   * Calculate risk/confidence scores
   */
  server.post('/decision/score', async (request: FastifyRequest<{ Body: DecisionAgentInput }>, reply: FastifyReply) => {
    const startTime = Date.now();

    try {
      const agent = createDecisionAgent({
        ...getAgentConfig(),
        dryRun: true, // Score doesn't persist
      });

      const context = createAgentContext({
        correlationId: request.headers['x-correlation-id'] as string || request.id as string,
        mode: 'cloud_run',
      });

      const result = await agent.invoke(request.body, context);

      return reply.send({
        confidence: result.event.confidence,
        risk_level: result.event.outputs.risk_level,
        constraints: result.event.constraints_applied,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          agent_id: agent.agentId,
          agent_version: agent.agentVersion,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      return reply.status(500).send({ error: (error as Error).message });
    }
  });

  /**
   * GET /decision/inspect
   * Inspect agent configuration
   */
  server.get('/decision/inspect', async (_request: FastifyRequest, reply: FastifyReply) => {
    const agent = createDecisionAgent({
      ruvector: { baseUrl: 'http://localhost:8080' },
      dryRun: true,
    });

    return reply.send({
      agent_id: agent.agentId,
      agent_version: agent.agentVersion,
      decision_type: agent.decisionType,
      contract: agent.contract,
    });
  });

  /**
   * GET /decision/registration
   * Get agent registration metadata
   */
  server.get('/decision/registration', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      agent_id: 'decision-agent',
      agent_version: '0.1.0',
      name: 'Decision Agent',
      classification: DECISION_AGENT_CONTRACT.metadata.classification,
      decision_types: DECISION_AGENT_CONTRACT.metadata.decision_types,
      consumers: DECISION_AGENT_CONTRACT.consumers,
      boundaries: DECISION_AGENT_CONTRACT.boundaries,
    });
  });
}

/**
 * Error handler for agent routes
 */
export function agentErrorHandler(
  error: Error,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  reply.status(500).send({
    success: false,
    errors: [{
      code: 'INTERNAL_ERROR',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
    }],
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
}
