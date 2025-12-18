/**
 * Entitlement Store
 *
 * In-memory storage for MVP. Interface designed for easy migration to database.
 */

import { Tier } from './tiers.js';

export interface Entitlements {
  userId: string;
  tier: Tier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageRecord {
  id: string;
  userId: string;
  endpoint: string;
  correlationId: string;
  timestamp: Date;
  requestCount: number;
  tokenCount: number;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

export interface UsageAggregation {
  userId: string;
  period: 'hourly' | 'daily' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  totalRequests: number;
  totalTokens: number;
  endpointBreakdown: Map<string, { requests: number; tokens: number }>;
}

/**
 * In-memory entitlement store for MVP
 * Interface designed to be easily replaced with database implementation
 */
export class InMemoryEntitlementStore {
  private entitlements: Map<string, Entitlements> = new Map();
  private usageRecords: UsageRecord[] = [];
  private aggregations: Map<string, UsageAggregation[]> = new Map();

  /**
   * Store user entitlement
   */
  async storeUserEntitlement(
    userId: string,
    tier: Tier,
    options?: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      subscriptionStatus?: Entitlements['subscriptionStatus'];
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
    }
  ): Promise<Entitlements> {
    const now = new Date();
    const existing = this.entitlements.get(userId);

    const entitlement: Entitlements = {
      userId,
      tier,
      stripeCustomerId: options?.stripeCustomerId || existing?.stripeCustomerId,
      stripeSubscriptionId: options?.stripeSubscriptionId || existing?.stripeSubscriptionId,
      subscriptionStatus: options?.subscriptionStatus || existing?.subscriptionStatus || 'active',
      currentPeriodStart: options?.currentPeriodStart || existing?.currentPeriodStart || now,
      currentPeriodEnd: options?.currentPeriodEnd || existing?.currentPeriodEnd,
      cancelAtPeriodEnd: options?.cancelAtPeriodEnd ?? existing?.cancelAtPeriodEnd ?? false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.entitlements.set(userId, entitlement);
    return entitlement;
  }

  /**
   * Lookup user entitlement
   */
  async lookupUserEntitlement(userId: string): Promise<Entitlements | null> {
    return this.entitlements.get(userId) || null;
  }

  /**
   * Store usage record
   */
  async storeUsageRecord(record: Omit<UsageRecord, 'id'>): Promise<UsageRecord> {
    const fullRecord: UsageRecord = {
      ...record,
      id: `${record.userId}-${record.correlationId}-${Date.now()}`,
    };

    this.usageRecords.push(fullRecord);

    // Update aggregations
    await this.updateAggregations(fullRecord);

    return fullRecord;
  }

  /**
   * Get usage records for a user within a date range
   */
  async getUsageRecords(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageRecord[]> {
    return this.usageRecords.filter(
      (record) =>
        record.userId === userId &&
        record.timestamp >= startDate &&
        record.timestamp <= endDate
    );
  }

  /**
   * Get aggregated usage for a user and period
   */
  async getUsageAggregation(
    userId: string,
    period: 'hourly' | 'daily' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<UsageAggregation[]> {
    const userAggs = this.aggregations.get(userId) || [];
    return userAggs.filter(
      (agg) =>
        agg.period === period &&
        agg.periodStart >= startDate &&
        agg.periodEnd <= endDate
    );
  }

  /**
   * Get current month usage summary
   */
  async getCurrentMonthUsage(userId: string): Promise<{
    requestsThisMonth: number;
    tokensThisMonth: number;
  }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const records = await this.getUsageRecords(userId, monthStart, monthEnd);

    return {
      requestsThisMonth: records.reduce((sum, r) => sum + r.requestCount, 0),
      tokensThisMonth: records.reduce((sum, r) => sum + r.tokenCount, 0),
    };
  }

  /**
   * Update aggregations when a new record is added
   */
  private async updateAggregations(record: UsageRecord): Promise<void> {
    const userId = record.userId;
    const timestamp = record.timestamp;

    // Create or update hourly aggregation
    this.updateAggregationForPeriod(userId, 'hourly', timestamp, record);

    // Create or update daily aggregation
    this.updateAggregationForPeriod(userId, 'daily', timestamp, record);

    // Create or update monthly aggregation
    this.updateAggregationForPeriod(userId, 'monthly', timestamp, record);
  }

  /**
   * Update aggregation for a specific period
   */
  private updateAggregationForPeriod(
    userId: string,
    period: 'hourly' | 'daily' | 'monthly',
    timestamp: Date,
    record: UsageRecord
  ): void {
    const { periodStart, periodEnd } = this.getPeriodBoundaries(timestamp, period);
    const key = `${userId}-${period}-${periodStart.getTime()}`;

    let userAggs = this.aggregations.get(userId) || [];
    let agg = userAggs.find(
      (a) => a.period === period && a.periodStart.getTime() === periodStart.getTime()
    );

    if (!agg) {
      agg = {
        userId,
        period,
        periodStart,
        periodEnd,
        totalRequests: 0,
        totalTokens: 0,
        endpointBreakdown: new Map(),
      };
      userAggs.push(agg);
      this.aggregations.set(userId, userAggs);
    }

    // Update totals
    agg.totalRequests += record.requestCount;
    agg.totalTokens += record.tokenCount;

    // Update endpoint breakdown
    const endpointStats = agg.endpointBreakdown.get(record.endpoint) || {
      requests: 0,
      tokens: 0,
    };
    endpointStats.requests += record.requestCount;
    endpointStats.tokens += record.tokenCount;
    agg.endpointBreakdown.set(record.endpoint, endpointStats);
  }

  /**
   * Get period boundaries for a given timestamp and period type
   */
  private getPeriodBoundaries(
    timestamp: Date,
    period: 'hourly' | 'daily' | 'monthly'
  ): { periodStart: Date; periodEnd: Date } {
    const date = new Date(timestamp);

    switch (period) {
      case 'hourly':
        return {
          periodStart: new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours(),
            0,
            0,
            0
          ),
          periodEnd: new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours(),
            59,
            59,
            999
          ),
        };

      case 'daily':
        return {
          periodStart: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
          periodEnd: new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            23,
            59,
            59,
            999
          ),
        };

      case 'monthly':
        return {
          periodStart: new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0),
          periodEnd: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999),
        };
    }
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    this.entitlements.clear();
    this.usageRecords = [];
    this.aggregations.clear();
  }

  /**
   * Get all entitlements (for admin/debugging)
   */
  async getAllEntitlements(): Promise<Entitlements[]> {
    return Array.from(this.entitlements.values());
  }
}

// Singleton instance for MVP
export const entitlementStore = new InMemoryEntitlementStore();
