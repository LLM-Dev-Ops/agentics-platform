/**
 * Request Router
 * Routes requests to appropriate Layer 3 cores
 * Implements SPARC routeToCore pseudocode
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import config from '../config.js';

export interface Layer3Core {
  name: string;
  url: string;
}

export interface ForwardRequestOptions {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  correlationId: string;
  userId: string;
  scopes: string[];
}

export interface UpstreamResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  streaming?: boolean;
}

/**
 * Route endpoint to Layer 3 core
 * Implements SPARC routeToCore pseudocode
 */
export function routeToCore(endpoint: string): Layer3Core | null {
  const routes: Record<string, Layer3Core> = {
    '/v1/intelligence': {
      name: 'LLM-Intelligence-Core',
      url: config.layer3Endpoints.intelligence,
    },
    '/v1/security': {
      name: 'LLM-Security-Core',
      url: config.layer3Endpoints.security,
    },
    '/v1/automation': {
      name: 'LLM-Automation-Core',
      url: config.layer3Endpoints.automation,
    },
    '/v1/governance': {
      name: 'LLM-Governance-Core',
      url: config.layer3Endpoints.governance,
    },
    '/v1/data': {
      name: 'LLM-Data-Core',
      url: config.layer3Endpoints.data,
    },
    '/v1/ecosystem': {
      name: 'LLM-Ecosystem-Core',
      url: config.layer3Endpoints.ecosystem,
    },
    '/v1/research': {
      name: 'LLM-Research-Core',
      url: config.layer3Endpoints.research,
    },
    '/v1/simulate': {
      name: 'agentics-orchestration-engine',
      url: config.layer3Endpoints.orchestration,
    },
    '/v1/interface': {
      name: 'LLM-Interface-Core',
      url: config.layer3Endpoints.interface,
    },
  };

  // Find matching route by prefix
  for (const [pattern, core] of Object.entries(routes)) {
    if (endpoint.startsWith(pattern)) {
      return core;
    }
  }

  return null;
}

/**
 * Forward request to Layer 3 core
 * Proxies the request with correlation headers
 */
export async function forwardRequest(
  core: Layer3Core,
  options: ForwardRequestOptions
): Promise<UpstreamResponse> {
  const { method, path, headers, body, correlationId, userId, scopes } = options;

  // Construct upstream URL
  const upstreamUrl = `${core.url}${path}`;

  // Prepare headers with correlation and identity context
  const upstreamHeaders: Record<string, string> = {
    ...headers,
    'X-Correlation-Id': correlationId,
    'X-User-Id': userId,
    'X-Scopes': scopes.join(','),
    'Content-Type': 'application/json',
  };

  // Remove Authorization header (identity already validated)
  delete upstreamHeaders['authorization'];
  delete upstreamHeaders['Authorization'];

  try {
    const response = await fetch(upstreamUrl, {
      method,
      headers: upstreamHeaders,
      ...(body && method !== 'GET' && method !== 'HEAD' ? { body: JSON.stringify(body) } : {}),
    });

    // Check if response is streaming
    const contentType = response.headers.get('content-type') || '';
    const isStreaming = contentType.includes('text/event-stream') ||
                       contentType.includes('application/stream+json');

    // Parse response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Handle streaming response
    if (isStreaming && response.body) {
      return {
        status: response.status,
        headers: responseHeaders,
        body: response.body, // Return ReadableStream for streaming
        streaming: true,
      };
    }

    // Handle regular response
    const responseBody = await response.text();
    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      parsedBody = responseBody;
    }

    return {
      status: response.status,
      headers: responseHeaders,
      body: parsedBody,
      streaming: false,
    };
  } catch (error) {
    throw new Error(`Failed to forward request to ${core.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Stream response from Layer 3 core to client
 */
export async function streamResponse(
  reply: FastifyReply,
  stream: ReadableStream
): Promise<void> {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      reply.raw.write(chunk);
    }
  } finally {
    reader.releaseLock();
    reply.raw.end();
  }
}

/**
 * Helper to extract request path without query parameters
 */
export function getRequestPath(url: string): string {
  return url.split('?')[0];
}

/**
 * Helper to determine if endpoint supports streaming
 */
export function isStreamingEndpoint(path: string): boolean {
  const streamingEndpoints = [
    '/v1/intelligence/completions',
    '/v1/intelligence/chat',
    '/v1/interface/conversations',
  ];

  return streamingEndpoints.some(endpoint => path.startsWith(endpoint));
}

/**
 * Compile simulation specification from various input formats
 * Used for unified simulation model
 */
export function compileSimulation(input: {
  specification?: unknown;
  cli_flags?: Record<string, unknown>;
  prompt?: string;
}): unknown {
  // If specification is provided, use it directly
  if (input.specification) {
    return validateSpecification(input.specification);
  }

  // If CLI flags are provided, compile to specification
  if (input.cli_flags) {
    return {
      scenario: input.cli_flags.scenario,
      parameters: extractParameters(input.cli_flags),
    };
  }

  // If prompt is provided, it will be sent to Intelligence Core for interpretation
  // (handled in the request handler)
  if (input.prompt) {
    return {
      type: 'prompt',
      prompt: input.prompt,
    };
  }

  throw new Error('No simulation input provided');
}

/**
 * Validate simulation specification structure
 */
function validateSpecification(specification: unknown): unknown {
  // Basic validation - in production, use a proper schema validator
  if (typeof specification !== 'object' || specification === null) {
    throw new Error('Invalid specification format');
  }

  return specification;
}

/**
 * Extract parameters from CLI flags
 */
function extractParameters(flags: Record<string, unknown>): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // Copy all flags except 'scenario' as parameters
  for (const [key, value] of Object.entries(flags)) {
    if (key !== 'scenario') {
      params[key] = value;
    }
  }

  return params;
}
