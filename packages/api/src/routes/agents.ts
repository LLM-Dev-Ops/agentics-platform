/**
 * Agent Routes
 *
 * PROMPT 3 Implementation: Wire agents into platform service.
 *
 * Routes for invoking agentics-dev-platform agents.
 * These agents are for decision synthesis, executive reporting, and risk scoring.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Agent invocation request
 */
interface AgentInvokeRequest {
  agent_id: string;
  command: 'decide' | 'summarize' | 'score' | 'inspect';
  input: {
    source_event_ids?: string[];
    time_range?: {
      start: string;
      end: string;
    };
    min_confidence?: number;
    decision_types?: string[];
    agent_ids?: string[];
    mode?: 'aggregate' | 'resolve_conflicts' | 'consensus';
    params?: Record<string, unknown>;
  };
  options?: {
    dry_run?: boolean;
    correlation_id?: string;
  };
}

/**
 * Agent response
 */
interface AgentInvokeResponse {
  success: boolean;
  event_id?: string;
  data?: Record<string, unknown>;
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  metadata: {
    execution_time_ms: number;
    agent_id: string;
    agent_version: string;
    timestamp: string;
  };
}

/**
 * Register agent routes
 */
export async function registerAgentRoutes(server: FastifyInstance): Promise<void> {
  /**
   * POST /v1/agents/invoke
   *
   * Invoke an agent with the specified command and input.
   */
  server.post<{
    Body: AgentInvokeRequest;
    Reply: AgentInvokeResponse;
  }>(
    '/agents/invoke',
    {
      schema: {
        body: {
          type: 'object',
          required: ['agent_id', 'command', 'input'],
          properties: {
            agent_id: {
              type: 'string',
              enum: ['decision-agent', 'executive-summary-agent', 'risk-scoring-agent'],
            },
            command: {
              type: 'string',
              enum: ['decide', 'summarize', 'score', 'inspect'],
            },
            input: {
              type: 'object',
              properties: {
                source_event_ids: { type: 'array', items: { type: 'string' } },
                time_range: {
                  type: 'object',
                  properties: {
                    start: { type: 'string', format: 'date-time' },
                    end: { type: 'string', format: 'date-time' },
                  },
                },
                min_confidence: { type: 'number', minimum: 0, maximum: 1 },
                decision_types: { type: 'array', items: { type: 'string' } },
                agent_ids: { type: 'array', items: { type: 'string' } },
                mode: { type: 'string', enum: ['aggregate', 'resolve_conflicts', 'consensus'] },
                params: { type: 'object' },
              },
            },
            options: {
              type: 'object',
              properties: {
                dry_run: { type: 'boolean' },
                correlation_id: { type: 'string' },
              },
            },
          },
        },
        response: {
          200: {
            description: 'Agent invocation successful',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              event_id: { type: 'string' },
              data: { type: 'object' },
              metadata: {
                type: 'object',
                properties: {
                  execution_time_ms: { type: 'number' },
                  agent_id: { type: 'string' },
                  agent_version: { type: 'string' },
                  timestamp: { type: 'string' },
                },
              },
            },
          },
          400: {
            description: 'Invalid request',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    field: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: AgentInvokeRequest }>, reply: FastifyReply) => {
      const startTime = Date.now();
      const { agent_id, command, input, options } = request.body;

      try {
        // Get ruvector service URL from environment
        const ruvectorUrl = process.env.RUVECTOR_SERVICE_URL;
        if (!ruvectorUrl && !options?.dry_run) {
          return reply.status(500).send({
            success: false,
            errors: [
              {
                code: 'CONFIG_ERROR',
                message: 'RUVECTOR_SERVICE_URL not configured',
              },
            ],
            metadata: {
              execution_time_ms: Date.now() - startTime,
              agent_id,
              agent_version: '0.1.0',
              timestamp: new Date().toISOString(),
            },
          });
        }

        // Dynamic import to avoid circular dependencies
        // @ts-ignore - @agentics/agents is resolved at runtime in the agents service
        const { createDecisionAgent } = await import(/* webpackIgnore: true */ '@agentics/agents') as any;
        // @ts-ignore
        const { createAgentContext } = await import(/* webpackIgnore: true */ '@agentics/agents') as any;

        // Create agent based on ID
        let agent;
        switch (agent_id) {
          case 'decision-agent':
            agent = createDecisionAgent({
              ruvector: {
                baseUrl: ruvectorUrl || 'http://localhost:8080',
                apiKey: process.env.RUVECTOR_API_KEY,
              },
              telemetry: {
                enabled: true,
                endpoint: process.env.TELEMETRY_ENDPOINT,
              },
              dryRun: options?.dry_run,
            });
            break;
          default:
            return reply.status(400).send({
              success: false,
              errors: [
                {
                  code: 'INVALID_AGENT',
                  message: `Unknown agent: ${agent_id}`,
                  field: 'agent_id',
                },
              ],
              metadata: {
                execution_time_ms: Date.now() - startTime,
                agent_id,
                agent_version: '0.1.0',
                timestamp: new Date().toISOString(),
              },
            });
        }

        // Create execution context
        const context = createAgentContext({
          correlationId: options?.correlation_id || request.id,
          mode: 'cloud_run',
          source: 'api-gateway',
          metadata: {
            request_id: request.id,
            user_agent: request.headers['user-agent'],
          },
        });

        // Invoke agent based on command
        let result;
        switch (command) {
          case 'decide':
          case 'summarize':
          case 'score':
            result = await agent.invoke(input, context);
            break;
          case 'inspect':
            return reply.send({
              success: true,
              data: {
                contract: agent.contract,
                metadata: agent.contract.metadata,
              },
              metadata: {
                execution_time_ms: Date.now() - startTime,
                agent_id: agent.agentId,
                agent_version: agent.agentVersion,
                timestamp: new Date().toISOString(),
              },
            });
          default:
            return reply.status(400).send({
              success: false,
              errors: [
                {
                  code: 'INVALID_COMMAND',
                  message: `Unknown command: ${command}`,
                  field: 'command',
                },
              ],
              metadata: {
                execution_time_ms: Date.now() - startTime,
                agent_id,
                agent_version: '0.1.0',
                timestamp: new Date().toISOString(),
              },
            });
        }

        // Return success response
        return reply.send({
          success: true,
          event_id: result.event.event_id,
          data: {
            decision_type: result.event.decision_type,
            confidence: result.event.confidence,
            risk_level: result.event.outputs.risk_level,
            recommendation: result.event.outputs.recommendation,
            summary: result.summary,
            outputs: result.event.outputs,
          },
          metadata: {
            execution_time_ms: Date.now() - startTime,
            agent_id: agent.agentId,
            agent_version: agent.agentVersion,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        request.log.error(error, 'Agent invocation failed');

        return reply.status(500).send({
          success: false,
          errors: [
            {
              code: 'AGENT_ERROR',
              message: (error as Error).message,
            },
          ],
          metadata: {
            execution_time_ms: Date.now() - startTime,
            agent_id,
            agent_version: '0.1.0',
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  );

  /**
   * GET /v1/agents
   *
   * List all registered agents.
   */
  server.get('/agents', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            agents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  version: { type: 'string' },
                  classification: { type: 'string' },
                  decision_types: { type: 'array', items: { type: 'string' } },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Static registry for now - could be dynamic from ruvector-service
    const agents = [
      {
        id: 'decision-agent',
        name: 'Decision Agent',
        version: '0.1.0',
        classification: 'DECISION_SYNTHESIS',
        decision_types: ['decision_synthesis', 'conflict_resolution', 'consensus_building'],
        status: 'active',
      },
      // Future agents would be registered here
    ];

    return reply.send({ agents });
  });

  /**
   * GET /v1/agents/:agentId/contract
   *
   * Get the contract for a specific agent.
   */
  server.get<{
    Params: { agentId: string };
  }>('/agents/:agentId/contract', {
    schema: {
      params: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { agentId } = request.params;

    try {
      // @ts-ignore - @agentics/agents resolved at runtime
      const { createDecisionAgent } = await import(/* webpackIgnore: true */ '@agentics/agents') as any;

      let contract;
      switch (agentId) {
        case 'decision-agent':
          const agent = createDecisionAgent({
            ruvector: { baseUrl: 'http://localhost:8080' },
            dryRun: true,
          });
          contract = agent.contract;
          break;
        default:
          return reply.status(404).send({
            error: 'Agent not found',
            code: 'NOT_FOUND',
            request_id: request.id,
          });
      }

      return reply.send({ contract });
    } catch (error) {
      return reply.status(500).send({
        error: (error as Error).message,
        code: 'INTERNAL_ERROR',
        request_id: request.id,
      });
    }
  });
}
