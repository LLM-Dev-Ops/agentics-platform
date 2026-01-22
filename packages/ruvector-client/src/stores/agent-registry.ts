/**
 * Agent Registry Store
 *
 * Persistence operations for agent registry via ruvector-service.
 */

import type { RegisteredAgent, AgentRegistrationRequest } from '@agentics/contracts';
import { RuvectorClient } from '../client.js';
import { RuvectorNotFoundError } from '../errors.js';

/**
 * Agent Registry Store
 */
export class AgentRegistryStore {
  private readonly client: RuvectorClient;

  constructor(client: RuvectorClient) {
    this.client = client;
  }

  /**
   * Register an agent
   */
  async register(request: AgentRegistrationRequest): Promise<RegisteredAgent> {
    return this.client.request<RegisteredAgent>(
      'POST',
      '/v1/registry/agents',
      request
    );
  }

  /**
   * Get an agent by ID
   */
  async get(agentId: string): Promise<RegisteredAgent> {
    try {
      return await this.client.request<RegisteredAgent>(
        'GET',
        `/v1/registry/agents/${agentId}`
      );
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        throw new RuvectorNotFoundError('Agent', agentId);
      }
      throw error;
    }
  }

  /**
   * List all registered agents
   */
  async list(options?: {
    status?: 'active' | 'deprecated' | 'disabled';
    classification?: string;
  }): Promise<RegisteredAgent[]> {
    const params = new URLSearchParams();
    if (options?.status) {
      params.set('status', options.status);
    }
    if (options?.classification) {
      params.set('classification', options.classification);
    }

    const queryString = params.toString();
    const path = `/v1/registry/agents${queryString ? `?${queryString}` : ''}`;

    const result = await this.client.request<{ agents: RegisteredAgent[] }>(
      'GET',
      path
    );
    return result.agents;
  }

  /**
   * Update agent status
   */
  async updateStatus(
    agentId: string,
    status: 'active' | 'deprecated' | 'disabled'
  ): Promise<RegisteredAgent> {
    return this.client.request<RegisteredAgent>(
      'PATCH',
      `/v1/registry/agents/${agentId}/status`,
      { status }
    );
  }

  /**
   * Record agent invocation
   */
  async recordInvocation(agentId: string): Promise<void> {
    await this.client.request(
      'POST',
      `/v1/registry/agents/${agentId}/invocations`,
      { timestamp: new Date().toISOString() }
    );
  }
}
