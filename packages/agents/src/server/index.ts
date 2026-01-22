/**
 * Agent Server
 *
 * Cloud Run / HTTP server for agent deployment.
 * Provides REST API endpoints for agent invocation.
 *
 * DEPLOYMENT MODEL:
 * - Deploys as Google Cloud Run service
 * - Stateless execution
 * - No local persistence
 * - All data via ruvector-service
 *
 * @module @agentics/agents/server
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { registerAgentRoutes, agentErrorHandler } from './routes.js';

/**
 * Server configuration
 */
interface ServerConfig {
  port: number;
  host: string;
  logLevel: string;
}

/**
 * Get server configuration from environment
 */
function getConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT ?? '8080', 10),
    host: process.env.HOST ?? '0.0.0.0',
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}

/**
 * Create and configure Fastify server
 */
export async function createServer(): Promise<FastifyInstance> {
  const config = getConfig();

  const server = Fastify({
    logger: {
      level: config.logLevel,
    },
    requestIdHeader: 'x-correlation-id',
    genReqId: () => `agent-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  });

  // Add request correlation ID to response
  server.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });

  // Global error handler
  server.setErrorHandler(agentErrorHandler);

  // Register routes
  await registerAgentRoutes(server);

  return server;
}

/**
 * Start the server
 */
export async function startServer(): Promise<void> {
  const config = getConfig();
  const server = await createServer();

  try {
    await server.listen({ port: config.port, host: config.host });
    console.log(`Agent server listening on ${config.host}:${config.port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  startServer();
}
