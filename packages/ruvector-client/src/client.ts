/**
 * RuVector Service Client
 *
 * HTTP client for ruvector-service persistence layer.
 * This is the ONLY way agentics-dev-platform agents persist data.
 */

import {
  RuvectorError,
  RuvectorConnectionError,
  RuvectorAuthError,
  RuvectorRateLimitError,
} from './errors.js';
import type { HealthCheckResponse } from './types.js';

/**
 * Client configuration
 */
export interface RuvectorClientConfig {
  /** Base URL of ruvector-service */
  baseUrl: string;

  /** API key for authentication */
  apiKey?: string;

  /** Service account token */
  serviceToken?: string;

  /** Request timeout in ms */
  timeout?: number;

  /** Retry configuration */
  retry?: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
}

/**
 * RuVector Service Client
 */
export class RuvectorClient {
  private readonly config: Required<RuvectorClientConfig>;

  constructor(config: RuvectorClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiKey: config.apiKey ?? '',
      serviceToken: config.serviceToken ?? '',
      timeout: config.timeout ?? 30000,
      retry: config.retry ?? {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
      },
    };
  }

  /**
   * Get base URL
   */
  get baseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Make authenticated request
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { timeout?: number }
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const timeout = options?.timeout ?? this.config.timeout;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.config.serviceToken) {
      headers['Authorization'] = `Bearer ${this.config.serviceToken}`;
    } else if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retry.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get('Retry-After') ?? '1000',
            10
          );
          throw new RuvectorRateLimitError(retryAfter);
        }

        if (response.status === 401) {
          throw new RuvectorAuthError('Authentication failed');
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>;
          throw new RuvectorError(
            (errorBody.message as string) ?? `Request failed: ${response.status}`,
            (errorBody.code as string) ?? 'REQUEST_FAILED',
            response.status,
            errorBody
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof RuvectorAuthError) {
          throw error;
        }

        if (error instanceof RuvectorRateLimitError) {
          if (attempt < this.config.retry.maxRetries) {
            await this.delay(error.retryAfter);
            continue;
          }
          throw error;
        }

        if ((error as NodeJS.ErrnoException).name === 'AbortError') {
          throw new RuvectorConnectionError(`Request timeout after ${timeout}ms`);
        }

        if (attempt < this.config.retry.maxRetries) {
          const delay = Math.min(
            this.config.retry.baseDelayMs * Math.pow(2, attempt),
            this.config.retry.maxDelayMs
          );
          await this.delay(delay);
        }
      }
    }

    throw new RuvectorConnectionError(
      `Request failed after ${this.config.retry.maxRetries + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Health check
   */
  async health(): Promise<HealthCheckResponse> {
    const start = Date.now();
    const response = await this.request<{ status: string; version: string }>(
      'GET',
      '/health'
    );
    return {
      status: response.status as 'healthy' | 'degraded' | 'unhealthy',
      latency_ms: Date.now() - start,
      version: response.version,
      timestamp: new Date().toISOString(),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
