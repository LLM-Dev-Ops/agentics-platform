/**
 * Usage Tracking Types for Layer 4 Agentics Platform
 *
 * Types for tracking resource consumption, quotas, and usage analytics
 * as defined in the SPARC specification.
 */

/**
 * Time period for usage aggregation
 */
export enum UsagePeriod {
  /** Current hour */
  HOURLY = 'hourly',
  /** Current day */
  DAILY = 'daily',
  /** Current week */
  WEEKLY = 'weekly',
  /** Current month */
  MONTHLY = 'monthly',
  /** All time */
  ALL_TIME = 'all_time',
}

/**
 * Granularity for usage history bucketing
 */
export enum UsageGranularity {
  /** Hourly buckets */
  HOUR = 'hour',
  /** Daily buckets */
  DAY = 'day',
  /** Weekly buckets */
  WEEK = 'week',
  /** Monthly buckets */
  MONTH = 'month',
}

/**
 * Summary of resource usage for a given period
 */
export interface UsageSummary {
  /** Total number of API requests */
  requests: number;
  /** Total tokens consumed (AI models) */
  tokens: number;
  /** Total compute seconds used */
  compute_seconds: number;
  /** Time period for this summary */
  period: UsagePeriod;
  /** ISO 8601 timestamp of period start */
  period_start: string;
  /** ISO 8601 timestamp of period end */
  period_end: string;
  /** Breakdown by resource type */
  by_resource?: Record<string, {
    /** Requests to this resource */
    requests: number;
    /** Tokens used by this resource */
    tokens?: number;
    /** Compute seconds for this resource */
    compute_seconds?: number;
  }>;
  /** Breakdown by Layer 3 core */
  by_core?: Record<string, {
    /** Requests to this core */
    requests: number;
    /** Tokens used by this core */
    tokens?: number;
    /** Compute seconds for this core */
    compute_seconds?: number;
  }>;
}

/**
 * Time-bucketed usage data point
 */
export interface UsageBucket {
  /** ISO 8601 timestamp of bucket start */
  timestamp: string;
  /** Number of requests in this bucket */
  requests: number;
  /** Tokens consumed in this bucket */
  tokens: number;
  /** Compute seconds in this bucket */
  compute_seconds?: number;
}

/**
 * Historical usage data with time-series buckets
 */
export interface UsageHistory {
  /** Array of time-bucketed usage data */
  buckets: UsageBucket[];
  /** Granularity of the buckets */
  granularity: UsageGranularity;
  /** ISO 8601 timestamp of history start */
  start_date: string;
  /** ISO 8601 timestamp of history end */
  end_date: string;
  /** Total usage across all buckets */
  totals: {
    /** Total requests */
    requests: number;
    /** Total tokens */
    tokens: number;
    /** Total compute seconds */
    compute_seconds: number;
  };
}

/**
 * Parameters for requesting usage summary
 */
export interface UsageParams {
  /** Time period for usage aggregation (default: monthly) */
  period?: UsagePeriod;
  /** Include breakdown by resource type */
  by_resource?: boolean;
  /** Include breakdown by Layer 3 core */
  by_core?: boolean;
}

/**
 * Parameters for requesting usage history
 */
export interface HistoryParams {
  /** ISO 8601 timestamp for history start */
  start: string;
  /** ISO 8601 timestamp for history end */
  end: string;
  /** Granularity for time buckets */
  granularity: UsageGranularity;
  /** Filter by specific resource type */
  resource?: string;
  /** Filter by specific Layer 3 core */
  core?: string;
}

/**
 * Real-time usage metrics
 */
export interface CurrentUsage {
  /** Requests in current period */
  requests_current: number;
  /** Request limit for current period */
  requests_limit: number;
  /** Percentage of request quota used (0-100) */
  requests_used_percent: number;
  /** Tokens in current period */
  tokens_current: number;
  /** Token limit for current period */
  tokens_limit: number;
  /** Percentage of token quota used (0-100) */
  tokens_used_percent: number;
  /** Compute seconds in current period */
  compute_seconds_current: number;
  /** Compute seconds limit for current period */
  compute_seconds_limit?: number;
  /** ISO 8601 timestamp when current period resets */
  resets_at: string;
}

/**
 * Usage alert configuration
 */
export interface UsageAlert {
  /** Alert identifier */
  id: string;
  /** Resource type to monitor */
  resource: 'requests' | 'tokens' | 'compute_seconds';
  /** Threshold percentage (0-100) */
  threshold: number;
  /** Whether alert is enabled */
  enabled: boolean;
  /** Notification channels */
  channels?: ('email' | 'webhook' | 'slack')[];
  /** Webhook URL for notifications */
  webhook_url?: string;
}

/**
 * Usage anomaly detection result
 */
export interface UsageAnomaly {
  /** ISO 8601 timestamp of anomaly */
  timestamp: string;
  /** Resource type with anomaly */
  resource: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
  /** Description of the anomaly */
  description: string;
  /** Actual value observed */
  actual_value: number;
  /** Expected value based on history */
  expected_value: number;
  /** Deviation percentage */
  deviation_percent: number;
}
