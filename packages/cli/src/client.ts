/**
 * API Client for Agentics CLI
 *
 * Provides a wrapper around the SDK client with error handling,
 * authentication, and output formatting for CLI use.
 */

import { getApiKey, getEndpoint } from './config.js';
import { error as displayError } from './output.js';
import type {
  AuthCredentials,
  AuthResult,
  Identity,
  ApiKey,
  CreateApiKeyParams,
  CreateApiKeyResponse,
  ListApiKeysResponse,
  SimulateParams,
  SimulationResult,
  SimulationStatus,
  CompletionParams,
  Completion,
  ListModelsResponse,
  UsageParams,
  UsageSummary,
  HistoryParams,
  UsageHistory,
  CurrentUsage,
  ErrorResponse,
} from './types.js';

/**
 * API Client error
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public requestId?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Make an authenticated API request
 *
 * @param path - API path (e.g., '/identity/whoami')
 * @param options - Fetch options
 * @returns Response data
 */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const endpoint = getEndpoint();
  const apiKey = getApiKey();
  const url = `${endpoint}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add authentication if API key is available
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Parse response body
    const body = (await response.json()) as ErrorResponse | { data?: T } | T;

    // Handle error responses
    if (!response.ok) {
      const errorBody = body as ErrorResponse;
      throw new ApiError(
        errorBody.error || 'Unknown error',
        errorBody.code || 'UNKNOWN_ERROR',
        errorBody.request_id,
        response.status
      );
    }

    // Return data from success response
    return (body as { data?: T }).data ?? (body as T);
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }

    // Handle network errors
    if (err instanceof Error) {
      throw new ApiError(
        err.message || 'Network error',
        'NETWORK_ERROR'
      );
    }

    throw new ApiError('Unknown error occurred', 'UNKNOWN_ERROR');
  }
}

/**
 * Handle API errors and display user-friendly messages
 *
 * @param err - Error to handle
 */
export function handleError(err: unknown): never {
  if (err instanceof ApiError) {
    displayError(err.message);

    // Provide helpful context for common errors
    if (err.code === 'AUTHENTICATION_REQUIRED') {
      console.log('\nPlease log in first:');
      console.log('  agentics login');
      console.log('\nOr set your API key:');
      console.log('  export AGENTICS_API_KEY=your-key-here');
    } else if (err.code === 'AUTHORIZATION_DENIED') {
      console.log('\nYou do not have permission to access this resource.');
      console.log('Check your API key scopes or contact support.');
    } else if (err.code === 'RATE_LIMIT_EXCEEDED') {
      console.log('\nRate limit exceeded. Please wait before trying again.');
    } else if (err.code === 'QUOTA_EXCEEDED') {
      console.log('\nQuota exceeded. Upgrade your plan or wait for reset.');
    }

    if (err.requestId) {
      console.log(`\nRequest ID: ${err.requestId}`);
    }

    process.exit(1);
  }

  // Handle unknown errors
  displayError(err instanceof Error ? err.message : 'Unknown error occurred');
  process.exit(1);
}

/**
 * API Client class
 */
export class AgenticsClient {
  /**
   * Authenticate with email/password or API key
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    return request<AuthResult>('/identity/authenticate', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  /**
   * Get current user identity
   */
  async whoami(): Promise<Identity> {
    return request<Identity>('/identity/whoami', {
      method: 'GET',
    });
  }

  /**
   * List API keys
   */
  async listApiKeys(): Promise<ApiKey[]> {
    const response = await request<ListApiKeysResponse>('/identity/api-keys', {
      method: 'GET',
    });
    return response.api_keys;
  }

  /**
   * Create a new API key
   */
  async createApiKey(params: CreateApiKeyParams): Promise<CreateApiKeyResponse> {
    return request<CreateApiKeyResponse>('/identity/api-keys', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await request<void>(`/identity/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Start a simulation
   */
  async simulate(params: SimulateParams): Promise<SimulationResult> {
    return request<SimulationResult>('/simulate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Get simulation status
   */
  async getSimulationStatus(simulationId: string): Promise<SimulationStatus> {
    return request<SimulationStatus>(`/simulate/${simulationId}`, {
      method: 'GET',
    });
  }

  /**
   * Cancel a simulation
   */
  async cancelSimulation(simulationId: string): Promise<void> {
    await request<void>(`/simulate/${simulationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Create a completion
   */
  async createCompletion(params: CompletionParams): Promise<Completion> {
    return request<Completion>('/intelligence/completions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List available models
   */
  async listModels(): Promise<ListModelsResponse> {
    return request<ListModelsResponse>('/intelligence/models', {
      method: 'GET',
    });
  }

  /**
   * Run a security scan
   */
  async securityScan(params: {
    target: string;
    type?: string;
  }): Promise<{ scan_id: string; status: string }> {
    return request<{ scan_id: string; status: string }>('/security/scan', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Get security scan results
   */
  async getSecurityScan(scanId: string): Promise<unknown> {
    return request<unknown>(`/security/scan/${scanId}`, {
      method: 'GET',
    });
  }

  /**
   * List automation workflows
   */
  async listWorkflows(): Promise<unknown[]> {
    const response = await request<{ workflows: unknown[] }>('/automation/workflows', {
      method: 'GET',
    });
    return response.workflows || [];
  }

  /**
   * Create an automation workflow
   */
  async createWorkflow(params: unknown): Promise<unknown> {
    return request<unknown>('/automation/workflows', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Trigger a workflow
   */
  async triggerWorkflow(workflowId: string, params?: unknown): Promise<unknown> {
    return request<unknown>(`/automation/workflows/${workflowId}/trigger`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string, executionId: string): Promise<unknown> {
    return request<unknown>(
      `/automation/workflows/${workflowId}/executions/${executionId}`,
      {
        method: 'GET',
      }
    );
  }

  /**
   * Get current usage
   */
  async getCurrentUsage(): Promise<CurrentUsage> {
    return request<CurrentUsage>('/usage/current', {
      method: 'GET',
    });
  }

  /**
   * Get usage summary
   */
  async getUsageSummary(params?: UsageParams): Promise<UsageSummary> {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.by_resource) query.set('by_resource', 'true');
    if (params?.by_core) query.set('by_core', 'true');

    const path = `/usage${query.toString() ? `?${query.toString()}` : ''}`;
    return request<UsageSummary>(path, {
      method: 'GET',
    });
  }

  /**
   * Get usage history
   */
  async getUsageHistory(params: HistoryParams): Promise<UsageHistory> {
    const query = new URLSearchParams({
      start: params.start,
      end: params.end,
      granularity: params.granularity,
    });
    if (params.resource) query.set('resource', params.resource);
    if (params.core) query.set('core', params.core);

    return request<UsageHistory>(`/usage/history?${query.toString()}`, {
      method: 'GET',
    });
  }
}

/**
 * Create a new client instance
 *
 * @returns New AgenticsClient instance
 */
export function createClient(): AgenticsClient {
  return new AgenticsClient();
}
