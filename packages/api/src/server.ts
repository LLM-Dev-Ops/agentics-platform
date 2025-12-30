console.log('🛠️ ROUTES REGISTERED ON THIS SERVER INSTANCE');

/**
 * API Gateway Server
 * Fastify server initialization with CORS, Helmet, logging, and error handling
 */

import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { v4 as uuidv4 } from 'uuid';
import config from './config.js';
import { registerObservabilityMiddleware } from './middleware/observability.js';
import { registerObservabilityRoutes } from './handlers/metrics.js';
import { registerLayer3HealthRoutes } from './routes/health.js';
import { registerProtectedExampleRoutes } from './routes/protected-example.js';
import { registerKeyRoutes } from './routes/keys.js';
import { registerMeRoute } from './routes/me.js';
import { handleRequest } from './handlers/request-lifecycle.js';

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

  // Register observability middleware (correlation ID, metrics, usage)
  registerObservabilityMiddleware(server);

  // Register observability routes (/metrics, /audit, /usage)
  registerObservabilityRoutes(server);

  // Register Layer 3 health routes (/health/intelligence, /health/security, etc.)
  registerLayer3HealthRoutes(server);

  // Dashboard routes — Supabase JWT auth (NO API key auth)
  await server.register(async (dashboard) => {
    await registerMeRoute(dashboard);
    await registerKeyRoutes(dashboard);
  }, { prefix: '/v1' });

  // Machine routes — API key auth enforced
  await server.register(async (api) => {
    api.addHook('onRequest', handleRequest);
    await registerProtectedExampleRoutes(api);
  }, { prefix: '/v1' });

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
