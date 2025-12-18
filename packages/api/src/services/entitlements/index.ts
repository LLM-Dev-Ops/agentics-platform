/**
 * Entitlement Service
 *
 * Main service for managing user entitlements, quotas, and usage tracking.
 * Integrates tier management, usage tracking, and billing.
 */

import { entitlementStore, Entitlements } from './store.js';
import { Tier, getTierLimits, isQuotaExceeded, TierLimits, UsageStats } from './tiers.js';
import { usageService } from './usage.js';
import { billingService } from './billing.js';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: {
    requests: number | null;
    tokens: number | null;
  };
  limits: {
    requests: number | null;
    tokens: number | null;
  };
  tier: Tier;
  quotaExceeded: boolean;
  reason?: string;
}

/**
 * EntitlementService - Main service for entitlement management
 */
export class EntitlementService {
  /**
   * Lookup user entitlements
   */
  async lookupEntitlements(userId: string): Promise<Entitlements> {
    let entitlement = await entitlementStore.lookupUserEntitlement(userId);

    // If no entitlement exists, create FREE tier by default
    if (!entitlement) {
      entitlement = await entitlementStore.storeUserEntitlement(userId, 'FREE');
    }

    return entitlement;
  }

  /**
   * Check if user can make a request (quota check)
   * NOTE: For MVP, this is permissive - we track but don't strictly enforce
   */
  async checkQuota(userId: string, endpoint: string): Promise<QuotaCheckResult> {
    const entitlement = await this.lookupEntitlements(userId);
    const limits = getTierLimits(entitlement.tier);

    // Get current usage
    const usage = await usageService.getCurrentUsageStats(userId);

    // Get API key count (to be implemented by identity service)
    // For now, assume 1 API key
    const usageStats: UsageStats = {
      requestsThisMonth: usage.requestsThisMonth,
      tokensThisMonth: usage.tokensThisMonth,
      apiKeyCount: 1, // Placeholder
    };

    // Check if quota is exceeded
    const quotaExceeded = isQuotaExceeded(usageStats, limits);

    // Calculate remaining quota
    const remaining = {
      requests:
        limits.requestsPerMonth !== null
          ? Math.max(0, limits.requestsPerMonth - usage.requestsThisMonth)
          : null,
      tokens:
        limits.tokensPerMonth !== null
          ? Math.max(0, limits.tokensPerMonth - usage.tokensThisMonth)
          : null,
    };

    // MVP: Allow requests even if quota exceeded (permissive mode)
    const allowed = true; // Will be changed to !quotaExceeded when enforcement is enabled

    let reason: string | undefined;
    if (quotaExceeded) {
      if (
        limits.requestsPerMonth !== null &&
        usage.requestsThisMonth >= limits.requestsPerMonth
      ) {
        reason = `Request quota exceeded (${usage.requestsThisMonth}/${limits.requestsPerMonth})`;
      } else if (limits.tokensPerMonth !== null && usage.tokensThisMonth >= limits.tokensPerMonth) {
        reason = `Token quota exceeded (${usage.tokensThisMonth}/${limits.tokensPerMonth})`;
      }
    }

    return {
      allowed,
      remaining,
      limits: {
        requests: limits.requestsPerMonth,
        tokens: limits.tokensPerMonth,
      },
      tier: entitlement.tier,
      quotaExceeded,
      reason,
    };
  }

  /**
   * Record API usage
   */
  async recordUsage(
    userId: string,
    endpoint: string,
    options?: {
      correlationId?: string;
      tokens?: number;
      responseTime?: number;
      statusCode?: number;
      error?: string;
    }
  ): Promise<void> {
    const correlationId = options?.correlationId || `${userId}-${endpoint}-${Date.now()}`;

    // Start usage tracking
    await usageService.recordUsageStart({ userId }, endpoint, correlationId);

    // End usage tracking with token count
    await usageService.recordUsageEnd({ userId }, endpoint, correlationId, {
      statusCode: options?.statusCode || 200,
      body: options?.tokens
        ? {
            usage: {
              total_tokens: options.tokens,
            },
          }
        : undefined,
      error: options?.error,
    });
  }

  /**
   * Get tier limits for a tier
   */
  getTierLimits(tier: Tier): TierLimits {
    return getTierLimits(tier);
  }

  /**
   * Upgrade user to a new tier
   */
  async upgradeTier(userId: string, newTier: Tier): Promise<Entitlements> {
    const entitlement = await this.lookupEntitlements(userId);

    // Validate tier upgrade path
    const tierRanking: Record<Tier, number> = {
      FREE: 0,
      DEVELOPER: 1,
      TEAM: 2,
      ENTERPRISE: 3,
    };

    if (tierRanking[newTier] < tierRanking[entitlement.tier]) {
      throw new Error(`Cannot downgrade from ${entitlement.tier} to ${newTier} via upgradeTier`);
    }

    return await entitlementStore.storeUserEntitlement(userId, newTier);
  }

  /**
   * Downgrade user to a new tier
   */
  async downgradeTier(userId: string, newTier: Tier): Promise<Entitlements> {
    return await entitlementStore.storeUserEntitlement(userId, newTier);
  }

  /**
   * Get usage summary for a user
   */
  async getUsageSummary(userId: string, period?: { start: Date; end: Date }) {
    return await usageService.getUsageSummary(userId, period);
  }

  /**
   * Get usage history for a user
   */
  async getUsageHistory(
    userId: string,
    start: Date,
    end: Date,
    granularity: 'hourly' | 'daily' | 'monthly'
  ) {
    return await usageService.getUsageHistory(userId, start, end, granularity);
  }

  /**
   * Check if user has a specific feature
   */
  async hasFeature(
    userId: string,
    feature: keyof TierLimits['features']
  ): Promise<boolean> {
    const entitlement = await this.lookupEntitlements(userId);
    const limits = getTierLimits(entitlement.tier);
    return limits.features[feature];
  }

  /**
   * Get billing service instance
   */
  getBillingService() {
    return billingService;
  }

  /**
   * Initialize user with FREE tier (called during user registration)
   */
  async initializeUser(userId: string): Promise<Entitlements> {
    return await entitlementStore.storeUserEntitlement(userId, 'FREE');
  }
}

// Singleton instance for MVP
export const entitlementService = new EntitlementService();

// Re-export types and utilities
export type { Entitlements, TierLimits };
export type { Tier };
export { getTierLimits, TIER_LIMITS } from './tiers.js';
export { usageService } from './usage.js';
export { billingService } from './billing.js';
