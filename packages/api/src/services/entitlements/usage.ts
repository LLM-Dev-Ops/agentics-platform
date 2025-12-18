/**
 * Usage Service
 *
 * Tracks and aggregates API usage for billing and quota enforcement.
 * Per SPARC pseudocode specification.
 */

import { v4 as uuidv4 } from 'uuid';
import { entitlementStore, UsageRecord } from './store.js';

export interface UsageSummary {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  requests: {
    total: number;
    byEndpoint: Record<string, number>;
  };
  tokens: {
    total: number;
    byEndpoint: Record<string, number>;
  };
  quotaStatus: {
    requestsUsed: number;
    requestsLimit: number | null;
    requestsRemaining: number | null;
    tokensUsed: number;
    tokensLimit: number | null;
    tokensRemaining: number | null;
  };
}

export interface UsageHistory {
  userId: string;
  granularity: 'hourly' | 'daily' | 'monthly';
  dataPoints: Array<{
    timestamp: Date;
    requests: number;
    tokens: number;
    endpointBreakdown: Record<string, { requests: number; tokens: number }>;
  }>;
}

export interface InFlightRequest {
  correlationId: string;
  userId: string;
  endpoint: string;
  startTime: Date;
}

/**
 * UsageService - Tracks and aggregates API usage
 */
export class UsageService {
  private inFlightRequests: Map<string, InFlightRequest> = new Map();

  /**
   * Record the start of a request
   */
  async recordUsageStart(
    identity: { userId: string },
    endpoint: string,
    correlationId?: string
  ): Promise<string> {
    const id = correlationId || uuidv4();

    const request: InFlightRequest = {
      correlationId: id,
      userId: identity.userId,
      endpoint,
      startTime: new Date(),
    };

    this.inFlightRequests.set(id, request);

    return id;
  }

  /**
   * Record the end of a request and extract usage data
   */
  async recordUsageEnd(
    identity: { userId: string },
    endpoint: string,
    correlationId: string,
    response?: {
      statusCode?: number;
      body?: any;
      error?: string;
    }
  ): Promise<void> {
    const request = this.inFlightRequests.get(correlationId);
    if (!request) {
      console.warn(`No in-flight request found for correlation ID: ${correlationId}`);
      return;
    }

    const endTime = new Date();
    const responseTime = endTime.getTime() - request.startTime.getTime();

    // Extract token usage from response if available
    const tokenCount = this.extractTokenUsage(response?.body);

    // Create usage record
    const record: Omit<UsageRecord, 'id'> = {
      userId: identity.userId,
      endpoint,
      correlationId,
      timestamp: request.startTime,
      requestCount: 1,
      tokenCount,
      responseTime,
      statusCode: response?.statusCode,
      error: response?.error,
    };

    // Store the record
    await entitlementStore.storeUsageRecord(record);

    // Increment usage counters
    await this.incrementUsageCounters(identity.userId, endpoint, record);

    // Clean up in-flight request
    this.inFlightRequests.delete(correlationId);
  }

  /**
   * Extract token usage from intelligence service responses
   */
  extractTokenUsage(responseBody?: any): number {
    if (!responseBody) {
      return 0;
    }

    // Handle standard intelligence service response format
    if (responseBody.usage) {
      if (typeof responseBody.usage.total_tokens === 'number') {
        return responseBody.usage.total_tokens;
      }
      if (typeof responseBody.usage.totalTokens === 'number') {
        return responseBody.usage.totalTokens;
      }
    }

    // Handle OpenAI-style response format
    if (responseBody.usage?.prompt_tokens && responseBody.usage?.completion_tokens) {
      return responseBody.usage.prompt_tokens + responseBody.usage.completion_tokens;
    }

    // Handle Anthropic-style response format
    if (responseBody.usage?.input_tokens && responseBody.usage?.output_tokens) {
      return responseBody.usage.input_tokens + responseBody.usage.output_tokens;
    }

    // No token usage found
    return 0;
  }

  /**
   * Increment usage counters for a user
   */
  async incrementUsageCounters(
    userId: string,
    endpoint: string,
    record: Omit<UsageRecord, 'id'>
  ): Promise<void> {
    // Counters are automatically updated via aggregations in the store
    // This method is a hook for future real-time counter updates if needed
    // For now, it's a no-op since the store handles aggregation
  }

  /**
   * Get usage summary for a user and period
   */
  async getUsageSummary(
    userId: string,
    period?: { start: Date; end: Date }
  ): Promise<UsageSummary> {
    // Default to current month if no period specified
    const now = new Date();
    const periodStart = period?.start || new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd =
      period?.end || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get usage records for the period
    const records = await entitlementStore.getUsageRecords(userId, periodStart, periodEnd);

    // Aggregate by endpoint
    const byEndpointRequests: Record<string, number> = {};
    const byEndpointTokens: Record<string, number> = {};

    let totalRequests = 0;
    let totalTokens = 0;

    records.forEach((record) => {
      totalRequests += record.requestCount;
      totalTokens += record.tokenCount;

      byEndpointRequests[record.endpoint] =
        (byEndpointRequests[record.endpoint] || 0) + record.requestCount;
      byEndpointTokens[record.endpoint] =
        (byEndpointTokens[record.endpoint] || 0) + record.tokenCount;
    });

    // Get user entitlement for quota status
    const entitlement = await entitlementStore.lookupUserEntitlement(userId);
    const tier = entitlement?.tier || 'FREE';

    // Import tier limits dynamically
    const { getTierLimits } = await import('./tiers.js');
    const limits = getTierLimits(tier);

    const requestsLimit = limits.requestsPerMonth;
    const tokensLimit = limits.tokensPerMonth;

    return {
      userId,
      period: {
        start: periodStart,
        end: periodEnd,
      },
      requests: {
        total: totalRequests,
        byEndpoint: byEndpointRequests,
      },
      tokens: {
        total: totalTokens,
        byEndpoint: byEndpointTokens,
      },
      quotaStatus: {
        requestsUsed: totalRequests,
        requestsLimit,
        requestsRemaining: requestsLimit !== null ? Math.max(0, requestsLimit - totalRequests) : null,
        tokensUsed: totalTokens,
        tokensLimit,
        tokensRemaining: tokensLimit !== null ? Math.max(0, tokensLimit - totalTokens) : null,
      },
    };
  }

  /**
   * Get usage history with specified granularity
   */
  async getUsageHistory(
    userId: string,
    start: Date,
    end: Date,
    granularity: 'hourly' | 'daily' | 'monthly'
  ): Promise<UsageHistory> {
    const aggregations = await entitlementStore.getUsageAggregation(
      userId,
      granularity,
      start,
      end
    );

    const dataPoints = aggregations.map((agg) => {
      const endpointBreakdown: Record<string, { requests: number; tokens: number }> = {};
      agg.endpointBreakdown.forEach((stats, endpoint) => {
        endpointBreakdown[endpoint] = stats;
      });

      return {
        timestamp: agg.periodStart,
        requests: agg.totalRequests,
        tokens: agg.totalTokens,
        endpointBreakdown,
      };
    });

    // Sort by timestamp
    dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      userId,
      granularity,
      dataPoints,
    };
  }

  /**
   * Get current usage stats for quota checking
   */
  async getCurrentUsageStats(userId: string): Promise<{
    requestsThisMonth: number;
    tokensThisMonth: number;
  }> {
    return await entitlementStore.getCurrentMonthUsage(userId);
  }

  /**
   * Clean up stale in-flight requests (for maintenance)
   */
  async cleanupStaleRequests(maxAgeMs: number = 300000): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    this.inFlightRequests.forEach((request, correlationId) => {
      const age = now.getTime() - request.startTime.getTime();
      if (age > maxAgeMs) {
        this.inFlightRequests.delete(correlationId);
        cleaned++;
      }
    });

    return cleaned;
  }
}

// Singleton instance for MVP
export const usageService = new UsageService();
