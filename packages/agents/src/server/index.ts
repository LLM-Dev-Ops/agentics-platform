/**
 * Agent Server
 *
 * Cloud Run / HTTP server for Apex agent deployment.
 * Provides REST API endpoints for agent invocation.
 *
 * DEPLOYMENT MODEL:
 * - Deploys as Google Cloud Run service
 * - Stateless execution
 * - No local persistence
 * - All data via ruvector-service
 *
 * APEX LAYER (Layer 5):
 * - Coordinates cross-cutting decisions
 * - Synthesizes signals from lower layers
 * - Presents executive-grade outputs
 * - NEVER executes irreversible actions
 *
 * STARTUP HARDENING:
 * - Asserts RUVECTOR_SERVICE_URL
 * - Asserts RUVECTOR_API_KEY (from Vault)
 * - Asserts AGENT_NAME, AGENT_PHASE, AGENT_LAYER
 * - Crashes if Ruvector unavailable
 *
 * @module @agentics/agents/server
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { registerAgentRoutes, agentErrorHandler } from './routes.js';
import {
  initializeStartup,
  setStartupConfig,
  PERFORMANCE_BUDGETS,
  APEX_CONFIG,
  StartupValidationError,
} from './startup.js';

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

  // Add Apex layer headers
  server.addHook('onSend', async (_request, reply) => {
    reply.header('X-Agent-Phase', APEX_CONFIG.AGENT_PHASE);
    reply.header('X-Agent-Layer', APEX_CONFIG.AGENT_LAYER);
  });

  // Global error handler
  server.setErrorHandler(agentErrorHandler);

  // Register routes
  await registerAgentRoutes(server);

  return server;
}

/**
 * Start the server with startup hardening
 *
 * CRITICAL: This function performs all startup validations.
 * The service WILL CRASH if:
 * - Required environment variables are missing
 * - Ruvector is unavailable
 */
export async function startServer(): Promise<void> {
  const config = getConfig();

  try {
    // ==========================================================================
    // STARTUP HARDENING - FAIL FAST
    // ==========================================================================
    console.log(`\n${'='.repeat(60)}`);
    console.log('APEX AGENT SERVICE STARTING');
    console.log(`Phase: ${APEX_CONFIG.AGENT_PHASE} | Layer: ${APEX_CONFIG.AGENT_LAYER}`);
    console.log(`${'='.repeat(60)}\n`);

    // Initialize and validate startup configuration
    // This will CRASH if:
    // - RUVECTOR_SERVICE_URL is missing
    // - RUVECTOR_API_KEY is missing
    // - Ruvector health check fails
    const startupConfig = await initializeStartup();
    setStartupConfig(startupConfig);

    // Log performance budgets
    console.log('[PERFORMANCE BUDGETS ACTIVE]');
    console.log(`  MAX_TOKENS: ${PERFORMANCE_BUDGETS.MAX_TOKENS}`);
    console.log(`  MAX_LATENCY_MS: ${PERFORMANCE_BUDGETS.MAX_LATENCY_MS}ms`);
    console.log(`  MAX_CALLS_PER_RUN: ${PERFORMANCE_BUDGETS.MAX_CALLS_PER_RUN}`);
    console.log('');

    // ==========================================================================
    // CREATE AND START SERVER
    // ==========================================================================
    const server = await createServer();

    await server.listen({ port: config.port, host: config.host });
    console.log(`\n✓ Apex Agent Server listening on ${config.host}:${config.port}`);
    console.log(`  Service: ${startupConfig.service.name}`);
    console.log(`  Version: ${startupConfig.service.version}`);
    console.log(`  Ruvector: ${startupConfig.ruvector.baseUrl}`);
    console.log('');

  } catch (error) {
    // ==========================================================================
    // CRASH ON STARTUP FAILURE
    // ==========================================================================
    console.error('\n' + '!'.repeat(60));
    console.error('FATAL: STARTUP FAILED - SERVICE WILL CRASH');
    console.error('!'.repeat(60));

    if (error instanceof StartupValidationError) {
      console.error(`\nValidation Error: ${error.message}`);
      if (error.missingVars?.length) {
        console.error(`Missing Variables: ${error.missingVars.join(', ')}`);
      }
      if (error.failedChecks?.length) {
        console.error(`Failed Checks: ${error.failedChecks.join(', ')}`);
      }
    } else {
      console.error('\nError:', error);
    }

    console.error('\n' + '!'.repeat(60));
    console.error('Exiting with code 1 to trigger Cloud Run restart policy');
    console.error('!'.repeat(60) + '\n');

    process.exit(1);
  }
}

// Export for testing
export { PERFORMANCE_BUDGETS, APEX_CONFIG };

// Start server if run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  startServer();
}
