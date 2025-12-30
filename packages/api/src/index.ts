/**
 * API Gateway Entry Point
 * Main server initialization and graceful shutdown handling
 */

import { createServer } from './server.js';
import config from './config.js';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  // Create server instance
  const server = await createServer();

  // Routes are now scoped in server.ts:
  // - Dashboard routes (/v1/me, /v1/keys) use Supabase JWT auth
  // - Machine routes use API key auth via handleRequest

  // Graceful shutdown handling
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  for (const signal of signals) {
    process.on(signal, async () => {
      server.log.info({ signal }, 'Received shutdown signal');

      try {
        await server.close();
        server.log.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        server.log.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    });
  }

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    server.log.error({ error }, 'Uncaught exception');
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    server.log.error({ reason, promise }, 'Unhandled promise rejection');
    process.exit(1);
  });

  // Start server
  try {
    await server.listen({
      port: config.port,
      host: config.host,
    });

    server.log.info(
      {
        port: config.port,
        host: config.host,
        nodeEnv: config.nodeEnv,
      },
      'API Gateway started successfully'
    );

    server.log.info(
      {
        intelligence: config.layer3Endpoints.intelligence,
        security: config.layer3Endpoints.security,
        automation: config.layer3Endpoints.automation,
        governance: config.layer3Endpoints.governance,
        data: config.layer3Endpoints.data,
        ecosystem: config.layer3Endpoints.ecosystem,
        research: config.layer3Endpoints.research,
        interface: config.layer3Endpoints.interface,
      },
      'Layer 3 core endpoints configured'
    );
  } catch (error) {
    server.log.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
