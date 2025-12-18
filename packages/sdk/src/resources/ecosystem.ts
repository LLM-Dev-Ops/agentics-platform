import type { AgenticsClient } from '../client';

/**
 * Integration
 */
export interface Integration {
  id: string;
  name: string;
  provider: string;
  type: 'llm' | 'tool' | 'data' | 'monitoring' | 'deployment';
  description: string;
  version: string;
  status: 'available' | 'beta' | 'deprecated';
  capabilities: string[];
  configuration: {
    required: Array<{
      name: string;
      type: string;
      description: string;
    }>;
    optional: Array<{
      name: string;
      type: string;
      description: string;
      default?: unknown;
    }>;
  };
  documentation: string;
  pricing?: {
    model: 'free' | 'usage' | 'subscription';
    details: string;
  };
}

/**
 * Connection parameters
 */
export interface ConnectParams {
  integrationId: string;
  name: string;
  configuration: Record<string, unknown>;
  enabled?: boolean;
}

/**
 * Connection
 */
export interface Connection {
  id: string;
  integrationId: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  configuration: Record<string, unknown>;
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastChecked: string;
    message?: string;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Marketplace item
 */
export interface MarketplaceItem {
  id: string;
  name: string;
  type: 'agent' | 'workflow' | 'tool' | 'template';
  description: string;
  author: {
    name: string;
    verified: boolean;
  };
  version: string;
  category: string;
  tags: string[];
  rating: {
    average: number;
    count: number;
  };
  downloads: number;
  pricing: {
    model: 'free' | 'paid' | 'freemium';
    price?: number;
  };
  preview?: string;
  documentation: string;
  publishedAt: string;
  updatedAt: string;
}

/**
 * Ecosystem resource
 */
export class Ecosystem {
  constructor(private client: AgenticsClient) {}

  /**
   * List available integrations
   */
  async integrations(): Promise<Integration[]> {
    return this.client.request<Integration[]>('GET', '/ecosystem/integrations');
  }

  /**
   * Connect to an integration
   */
  async connect(params: ConnectParams): Promise<Connection> {
    return this.client.request<Connection>('POST', '/ecosystem/connections', params);
  }

  /**
   * Browse marketplace items
   */
  async marketplace(): Promise<MarketplaceItem[]> {
    return this.client.request<MarketplaceItem[]>('GET', '/ecosystem/marketplace');
  }
}
