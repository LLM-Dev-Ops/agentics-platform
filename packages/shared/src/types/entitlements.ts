/**
 * Entitlements and Tier Types for Layer 4 Agentics Platform
 *
 * Subscription tiers, quota limits, and entitlement management
 * as defined in the SPARC specification.
 */

/**
 * Available subscription tiers
 */
export enum EntitlementTier {
  /** Free tier with basic limits */
  FREE = 'FREE',
  /** Developer tier with increased limits */
  DEVELOPER = 'DEVELOPER',
  /** Team tier for collaborative work */
  TEAM = 'TEAM',
  /** Enterprise tier with custom limits */
  ENTERPRISE = 'ENTERPRISE',
}

/**
 * Resource limits for a tier
 */
export interface ResourceLimits {
  /** Maximum API requests per month */
  requests_per_month: number;
  /** Maximum tokens per month (AI models) */
  tokens_per_month: number;
  /** Maximum number of API keys */
  api_keys: number;
  /** Maximum compute seconds per month */
  compute_seconds_per_month?: number;
  /** Maximum storage in GB */
  storage_gb?: number;
  /** Maximum concurrent requests */
  concurrent_requests?: number;
  /** Maximum file upload size in MB */
  max_upload_size_mb?: number;
  /** Maximum team members */
  max_team_members?: number;
  /** Maximum simulations per month */
  simulations_per_month?: number;
  /** Maximum automation workflows */
  max_workflows?: number;
  /** Rate limit (requests per second) */
  rate_limit_per_second?: number;
}

/**
 * Feature flags for a tier
 */
export interface TierFeatures {
  /** Access to advanced AI models */
  advanced_models?: boolean;
  /** Access to fine-tuning */
  fine_tuning?: boolean;
  /** Priority support */
  priority_support?: boolean;
  /** Custom domain support */
  custom_domain?: boolean;
  /** SSO/SAML authentication */
  sso_enabled?: boolean;
  /** Audit logging */
  audit_logs?: boolean;
  /** SLA guarantee percentage */
  sla_percentage?: number;
  /** Access to beta features */
  beta_access?: boolean;
  /** White-label capabilities */
  white_label?: boolean;
  /** Dedicated infrastructure */
  dedicated_infrastructure?: boolean;
}

/**
 * User's current entitlements
 */
export interface Entitlements {
  /** Current subscription tier */
  tier: EntitlementTier;
  /** Resource limits for this tier */
  limits: ResourceLimits;
  /** Feature flags for this tier */
  features?: TierFeatures;
  /** ISO 8601 timestamp when tier became active */
  tier_start_date?: string;
  /** ISO 8601 timestamp when tier expires (if applicable) */
  tier_end_date?: string;
  /** Whether tier is in trial period */
  is_trial?: boolean;
  /** Days remaining in trial */
  trial_days_remaining?: number;
  /** Custom overrides to default limits */
  custom_limits?: Partial<ResourceLimits>;
}

/**
 * Tier comparison information
 */
export interface TierInfo {
  /** Tier identifier */
  tier: EntitlementTier;
  /** Display name */
  name: string;
  /** Tier description */
  description: string;
  /** Monthly price in cents (USD) */
  price_monthly_cents: number;
  /** Annual price in cents (USD) */
  price_annual_cents?: number;
  /** Resource limits */
  limits: ResourceLimits;
  /** Available features */
  features: TierFeatures;
  /** Recommended use case */
  recommended_for?: string;
  /** Whether this tier is currently available for signup */
  available?: boolean;
}

/**
 * Request to upgrade/downgrade tier
 */
export interface ChangeTierParams {
  /** Target tier */
  target_tier: EntitlementTier;
  /** Billing period */
  billing_period?: 'monthly' | 'annual';
  /** Payment method ID */
  payment_method_id?: string;
  /** Promo code for discounts */
  promo_code?: string;
}

/**
 * Tier change result
 */
export interface ChangeTierResult {
  /** Whether change was successful */
  success: boolean;
  /** New entitlements */
  entitlements: Entitlements;
  /** ISO 8601 timestamp when change takes effect */
  effective_date: string;
  /** Prorated charge/credit in cents */
  prorated_amount_cents?: number;
  /** Next billing date */
  next_billing_date?: string;
}

/**
 * Quota override for specific resource
 */
export interface QuotaOverride {
  /** Resource type */
  resource: keyof ResourceLimits;
  /** Override value */
  value: number;
  /** Reason for override */
  reason?: string;
  /** ISO 8601 timestamp when override expires */
  expires_at?: string;
  /** Who created the override */
  created_by?: string;
}

/**
 * List of all available tiers
 */
export interface ListTiersResponse {
  /** Array of tier information */
  tiers: TierInfo[];
}

/**
 * Entitlement grant for temporary access
 */
export interface EntitlementGrant {
  /** Grant identifier */
  id: string;
  /** Type of grant */
  grant_type: 'trial' | 'promotional' | 'beta' | 'custom';
  /** Features granted */
  features: Partial<TierFeatures>;
  /** Additional limits granted */
  limits?: Partial<ResourceLimits>;
  /** ISO 8601 timestamp when grant starts */
  starts_at: string;
  /** ISO 8601 timestamp when grant expires */
  expires_at: string;
  /** Grant description */
  description?: string;
  /** Whether grant is currently active */
  active: boolean;
}
