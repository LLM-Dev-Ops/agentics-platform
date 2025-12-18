/**
 * Layer 3 Router
 *
 * Handles forwarding requests from Layer 4 to Layer 3 cores.
 * All business logic executes in Layer 3; Layer 4 only routes.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import config from '../config.js';

export interface ForwardRequestOptions {
  method: string;
  path: string;
  body?: any;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  correlationId: string;
  userId: string;
  scopes: string[];
}

export interface RouterResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

/**
 * Forward a request to a Layer 3 core
 */
export async function forwardRequest(
  core: keyof typeof config.layer3Endpoints,
  options: ForwardRequestOptions
): Promise<RouterResponse> {
  const baseUrl = config.layer3Endpoints[core];
  const url = `${baseUrl}${options.path}${buildQueryString(options.query)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': options.correlationId,
    'X-User-Id': options.userId,
    'X-Scopes': options.scopes.join(','),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const responseBody = await parseResponseBody(response);

    return {
      statusCode: response.status,
      headers: extractHeaders(response.headers),
      body: responseBody,
    };
  } catch (error) {
    // If Layer 3 core is unreachable
    throw new Error(`Failed to reach ${core} core: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Forward a streaming request to a Layer 3 core
 */
export async function forwardStreamingRequest(
  core: keyof typeof config.layer3Endpoints,
  options: ForwardRequestOptions,
  reply: FastifyReply
): Promise<void> {
  const baseUrl = config.layer3Endpoints[core];
  const url = `${baseUrl}${options.path}${buildQueryString(options.query)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': options.correlationId,
    'X-User-Id': options.userId,
    'X-Scopes': options.scopes.join(','),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await parseResponseBody(response);
      reply.code(response.status).send(errorBody);
      return;
    }

    // Set response headers
    reply.header('Content-Type', response.headers.get('content-type') || 'application/json');
    reply.header('X-Correlation-Id', options.correlationId);

    // Stream the response
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          reply.raw.write(chunk);
        }
        reply.raw.end();
      } catch (error) {
        reply.raw.end();
        throw error;
      }
    } else {
      reply.send({});
    }
  } catch (error) {
    throw new Error(`Failed to stream from ${core} core: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build query string from query parameters
 */
function buildQueryString(query?: Record<string, any>): string {
  if (!query || Object.keys(query).length === 0) {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Parse response body (handles both JSON and text)
 */
async function parseResponseBody(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }

  return await response.text();
}

/**
 * Extract relevant headers from response
 */
function extractHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};

  // Extract specific headers we want to pass through
  const headersToExtract = [
    'content-type',
    'x-correlation-id',
    'x-request-id',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
  ];

  for (const header of headersToExtract) {
    const value = headers.get(header);
    if (value) {
      result[header] = value;
    }
  }

  return result;
}

/**
 * Extract identity from Fastify request
 * This assumes auth middleware has already validated and attached identity
 */
export interface RequestIdentity {
  userId: string;
  scopes: string[];
  email?: string;
}

export function getIdentity(request: FastifyRequest): RequestIdentity {
  // Identity should be attached by auth middleware
  const identity = (request as any).identity;

  if (!identity) {
    throw new Error('No identity found on request - auth middleware may not have run');
  }

  return {
    userId: identity.userId,
    scopes: identity.scopes || [],
    email: identity.email,
  };
}

/**
 * Generate correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
