/**
 * API Gateway Server
 * Fastify server initialization with CORS, Helmet, logging, and error handling
 */

import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rawBody from 'fastify-raw-body';
import { v4 as uuidv4 } from 'uuid';
import config from './config.js';
import { registerObservabilityMiddleware } from './middleware/observability.js';
import { registerObservabilityRoutes } from './handlers/metrics.js';
import { registerLayer3HealthRoutes } from './routes/health.js';
import { registerProtectedExampleRoutes } from './routes/protected-example.js';
import { registerKeyRoutes } from './routes/keys.js';
import { registerMeRoute } from './routes/me.js';
import { registerUsageProxyRoutes } from './routes/usage-proxy.js';
import { handleRequest } from './handlers/request-lifecycle.js';
import { registerEnterpriseRoutes } from './routes/enterprise.js';
import { registerCliAuthRoutes } from './routes/cli-auth.js';
import { registerAgentRoutes } from './routes/agents.js';
import { registerAuthSessionRoutes } from './routes/auth-session.js';
import { registerCliCommandRoutes } from './routes/cli-commands.js';
import { registerCoherenceRoutes } from './routes/coherence.js';

export interface ErrorResponse {
  error: string;
  code: string;
  request_id: string;
  details?: Record<string, unknown>;
}

export interface ServerOptions extends FastifyServerOptions {
  // Additional custom options can be added here
}

/**
 * Create and configure Fastify server instance
 */
export async function createServer(opts: ServerOptions = {}): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: config.logging.level,
      ...(config.logging.pretty
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'correlationId',
    genReqId: () => uuidv4(),
    ...opts,
  });

  // Register CORS plugin
  await server.register(cors, {
    origin: true, // Allow all origins in development (should be restricted in production)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });

  // Register Helmet plugin for security headers
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // Register raw body plugin for Stripe webhook signature verification
  // Required for routes with config.rawBody = true
  await server.register(rawBody, {
    field: 'rawBody',
    global: false, // Only parse raw body for routes that request it
    encoding: 'utf8',
    runFirst: true, // Run before other parsers
  });

  // Register observability middleware (correlation ID, metrics, usage)
  registerObservabilityMiddleware(server);

  // Register observability routes (/metrics, /audit, /usage)
  registerObservabilityRoutes(server);

  // Register Layer 3 health routes (/health/intelligence, /health/security, etc.)
  registerLayer3HealthRoutes(server);

  // Enterprise gate routes — Stripe webhook (verified via signature, no auth)
  // This is CORE INFRASTRUCTURE - controls binary enterprise entitlement
  await registerEnterpriseRoutes(server);

  // CLI auth routes — Public (device flow for CLI authentication)
  // This enables browser-based authentication for CLI tools
  await server.register(async (cliAuth) => {
    await registerCliAuthRoutes(cliAuth);
  }, { prefix: '/v1' });

  // Auth session route — API key validation for CLI whoami
  // Returns { email, user_id, org_id, payment_status }
  await server.register(async (authSession) => {
    await registerAuthSessionRoutes(authSession);
  }, { prefix: '/v1' });

  // CLI command routes — All CLI command domains (plan, deploy, export, policy, quantify, erp)
  // These routes handle API key auth internally and return valid responses
  await server.register(async (cliCommands) => {
    await registerCliCommandRoutes(cliCommands);
  }, { prefix: '/v1' });

  // Dashboard routes — Supabase JWT auth (NO API key auth)
  await server.register(async (dashboard) => {
    await registerMeRoute(dashboard);
    await registerKeyRoutes(dashboard);
    await registerUsageProxyRoutes(dashboard);
  }, { prefix: '/v1' });

  // Machine routes — API key auth enforced
  await server.register(async (api) => {
    api.addHook('onRequest', handleRequest);
    await registerProtectedExampleRoutes(api);
  }, { prefix: '/v1' });

  // Agent routes — Decision synthesis, executive reporting, risk scoring
  // These routes are for agentics-dev-platform agents
  await server.register(async (agents) => {
    await registerAgentRoutes(agents);
  }, { prefix: '/v1' });

  // Coherence routes — ADR/DDD #005: System Coherence, Drift Detection, Self-Governance
  // These routes provide observation-only access to coherence domain services
  // CRITICAL: These routes do NOT trigger automatic remediation (INV-C3)
  registerCoherenceRoutes(server);

  // Request logging
  server.addHook('onRequest', async (request, reply) => {
    request.log.info({
      method: request.method,
      url: request.url,
      correlationId: request.id,
    }, 'Incoming request');
  });

  // Response logging
  server.addHook('onResponse', async (request, reply) => {
    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
      correlationId: request.id,
    }, 'Request completed');
  });

  // Global error handler
  server.setErrorHandler((error, request, reply) => {
    const correlationId = request.id;

    request.log.error({
      error: error.message,
      stack: error.stack,
      correlationId,
    }, 'Request error');

    // Determine status code
    let statusCode = error.statusCode || 500;
    let errorCode = 'INTERNAL_ERROR';
    let errorMessage = error.message || 'An unexpected error occurred';

    // Handle specific error types
    if (error.validation) {
      statusCode = 400;
      errorCode = 'INVALID_REQUEST';
      errorMessage = 'Request validation failed';
    }

    const errorResponse: ErrorResponse = {
      error: errorMessage,
      code: errorCode,
      request_id: correlationId,
      ...(error.validation ? { details: { validation: error.validation } } : {}),
    };

    reply.status(statusCode).send(errorResponse);
  });

  // Health check endpoint
  server.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    };
  });

  // Ready check endpoint
  server.get('/ready', async (request, reply) => {
    // In production, this would check Layer 3 core connectivity
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  });

  return server;
}

/**
 * Create error response with consistent format
 */
export function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  correlationId: string,
  details?: Record<string, unknown>
): { statusCode: number; response: ErrorResponse } {
  return {
    statusCode,
    response: {
      error: message,
      code,
      request_id: correlationId,
      ...(details ? { details } : {}),
    },
  };
}
