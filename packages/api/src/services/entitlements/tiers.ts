/**
 * Entitlement Tiers and Limits
 *
 * Defines subscription tiers and their usage limits per SPARC specification.
 */

export type Tier = 'FREE' | 'DEVELOPER' | 'TEAM' | 'ENTERPRISE';

export interface TierLimits {
  tier: Tier;
  requestsPerMonth: number | null; // null = unlimited
  tokensPerMonth: number | null; // null = unlimited
  maxApiKeys: number | null; // null = unlimited
  features: {
    multipleIdentities: boolean;
    teamCollaboration: boolean;
    prioritySupport: boolean;
    customIntegrations: boolean;
    sla: boolean;
  };
}

/**
 * Tier limit definitions per SPARC specification
 */
export const TIER_LIMITS: Record<Tier, TierLimits> = {
  FREE: {
    tier: 'FREE',
    requestsPerMonth: 1_000,
    tokensPerMonth: 100_000,
    maxApiKeys: 1,
    features: {
      multipleIdentities: false,
      teamCollaboration: false,
      prioritySupport: false,
      customIntegrations: false,
      sla: false,
    },
  },
  DEVELOPER: {
    tier: 'DEVELOPER',
    requestsPerMonth: 50_000,
    tokensPerMonth: 5_000_000,
    maxApiKeys: 10,
    features: {
      multipleIdentities: true,
      teamCollaboration: false,
      prioritySupport: false,
      customIntegrations: false,
      sla: false,
    },
  },
  TEAM: {
    tier: 'TEAM',
    requestsPerMonth: 500_000,
    tokensPerMonth: 50_000_000,
    maxApiKeys: 100,
    features: {
      multipleIdentities: true,
      teamCollaboration: true,
      prioritySupport: true,
      customIntegrations: false,
      sla: false,
    },
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    requestsPerMonth: null, // unlimited
    tokensPerMonth: null, // unlimited
    maxApiKeys: null, // unlimited
    features: {
      multipleIdentities: true,
      teamCollaboration: true,
      prioritySupport: true,
      customIntegrations: true,
      sla: true,
    },
  },
};

export interface UsageStats {
  requestsThisMonth: number;
  tokensThisMonth: number;
  apiKeyCount: number;
}

/**
 * Get tier limits for a given tier
 */
export function getTierLimits(tier: Tier): TierLimits {
  const limits = TIER_LIMITS[tier];
  if (!limits) {
    throw new Error(`Invalid tier: ${tier}`);
  }
  return limits;
}

/**
 * Check if quota is exceeded for a given usage and limits
 */
export function isQuotaExceeded(usage: UsageStats, limits: TierLimits): boolean {
  // ENTERPRISE tier has no limits
  if (limits.tier === 'ENTERPRISE') {
    return false;
  }

  // Check request quota
  if (limits.requestsPerMonth !== null && usage.requestsThisMonth >= limits.requestsPerMonth) {
    return true;
  }

  // Check token quota
  if (limits.tokensPerMonth !== null && usage.tokensThisMonth >= limits.tokensPerMonth) {
    return true;
  }

  // Check API key count
  if (limits.maxApiKeys !== null && usage.apiKeyCount > limits.maxApiKeys) {
    return true;
  }

  return false;
}

/**
 * Calculate remaining quota for a given usage and limits
 */
export function getRemainingQuota(usage: UsageStats, limits: TierLimits): {
  requests: number | null;
  tokens: number | null;
} {
  // ENTERPRISE tier has unlimited quota
  if (limits.tier === 'ENTERPRISE') {
    return {
      requests: null,
      tokens: null,
    };
  }

  return {
    requests: limits.requestsPerMonth !== null
      ? Math.max(0, limits.requestsPerMonth - usage.requestsThisMonth)
      : null,
    tokens: limits.tokensPerMonth !== null
      ? Math.max(0, limits.tokensPerMonth - usage.tokensThisMonth)
      : null,
  };
}

/**
 * Validate if a tier is valid
 */
export function isValidTier(tier: string): tier is Tier {
  return tier in TIER_LIMITS;
}
