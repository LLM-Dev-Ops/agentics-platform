import { createErrorFromResponse, type ErrorResponse } from './errors';
import { Identity } from './resources/identity';
import { Simulate } from './resources/simulate';
import { Intelligence } from './resources/intelligence';
import { Security } from './resources/security';
import { Automation } from './resources/automation';
import { Governance } from './resources/governance';
import { Data } from './resources/data';
import { Ecosystem } from './resources/ecosystem';
import { Research } from './resources/research';
import { Usage } from './resources/usage';

/**
 * Client configuration options
 */
export interface AgenticsClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

/**
 * Main SDK client for the Agentics Platform
 */
export class AgenticsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retries: number;

  // Resources
  public readonly identity: Identity;
  public readonly simulate: Simulate;
  public readonly intelligence: Intelligence;
  public readonly security: Security;
  public readonly automation: Automation;
  public readonly governance: Governance;
  public readonly data: Data;
  public readonly ecosystem: Ecosystem;
  public readonly research: Research;
  public readonly usage: Usage;

  constructor(options: AgenticsClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.agentics.dev/v1';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;

    // Initialize resources
    this.identity = new Identity(this);
    this.simulate = new Simulate(this);
    this.intelligence = new Intelligence(this);
    this.security = new Security(this);
    this.automation = new Automation(this);
    this.governance = new Governance(this);
    this.data = new Data(this);
    this.ecosystem = new Ecosystem(this);
    this.research = new Research(this);
    this.usage = new Usage(this);
  }

  /**
   * Internal method to make HTTP requests with retries and error handling
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': '@agentics/sdk/1.0.0',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle successful responses
        if (response.ok) {
          // Handle empty responses (e.g., DELETE)
          if (response.status === 204 || response.headers.get('content-length') === '0') {
            return undefined as T;
          }
          return await response.json() as T;
        }

        // Handle error responses
        const retryAfter = response.headers.get('retry-after');
        const errorBody = await response.json() as ErrorResponse;
        const error = createErrorFromResponse(
          errorBody,
          response.status,
          retryAfter ? parseInt(retryAfter, 10) : undefined
        );

        // Don't retry on client errors (4xx) except rate limits
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw error;
        }

        lastError = error;

        // Wait before retrying with exponential backoff
        if (attempt < this.retries - 1) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          lastError = new Error(`Request timeout after ${this.timeout}ms`);
        } else if (err instanceof Error) {
          lastError = err;
        } else {
          lastError = new Error('Unknown error occurred');
        }

        // Don't retry on network errors if this is the last attempt
        if (attempt === this.retries - 1) {
          throw lastError;
        }

        // Wait before retrying
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Internal method to stream responses using Server-Sent Events
   */
  async *stream<T>(
    method: 'POST',
    path: string,
    body: unknown
  ): AsyncIterable<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'User-Agent': '@agentics/sdk/1.0.0',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json() as ErrorResponse;
      throw createErrorFromResponse(errorBody, response.status);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              yield JSON.parse(data) as T;
            } catch (err) {
              console.error('Failed to parse SSE data:', err);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
