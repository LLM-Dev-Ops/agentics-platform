import type { AgenticsClient } from '../client';

/**
 * Usage query parameters
 */
export interface UsageQueryParams {
  startDate?: string;
  endDate?: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
  groupBy?: 'model' | 'resource' | 'user';
}

/**
 * Usage summary
 */
export interface UsageSummary {
  period: {
    startDate: string;
    endDate: string;
  };
  totals: {
    requests: number;
    tokens: number;
    cost: number;
  };
  breakdown: {
    byModel: Record<string, {
      requests: number;
      tokens: number;
      cost: number;
    }>;
    byResource: Record<string, {
      requests: number;
      cost: number;
    }>;
  };
  quota: {
    limit: number;
    used: number;
    remaining: number;
    resetAt: string;
  };
}

/**
 * Usage history entry
 */
export interface UsageHistoryEntry {
  timestamp: string;
  resource: string;
  model?: string;
  requests: number;
  tokens?: number;
  cost: number;
  metadata?: Record<string, unknown>;
}

/**
 * Usage history
 */
export interface UsageHistory {
  period: {
    startDate: string;
    endDate: string;
  };
  granularity: 'hour' | 'day' | 'week' | 'month';
  entries: UsageHistoryEntry[];
  totals: {
    requests: number;
    tokens: number;
    cost: number;
  };
}

/**
 * Usage resource
 */
export class Usage {
  constructor(private client: AgenticsClient) {}

  /**
   * Get current usage summary
   */
  async current(params?: UsageQueryParams): Promise<UsageSummary> {
    const queryString = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.client.request<UsageSummary>('GET', `/usage/current${queryString}`);
  }

  /**
   * Get usage history
   */
  async history(params: UsageQueryParams): Promise<UsageHistory> {
    const queryString = new URLSearchParams(params as Record<string, string>).toString();
    return this.client.request<UsageHistory>('GET', `/usage/history?${queryString}`);
  }
}
