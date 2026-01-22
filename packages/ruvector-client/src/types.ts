/**
 * RuVector Client Types
 */

import type { DecisionType } from '@agentics/contracts';

/**
 * Query options for fetching decision events
 */
export interface DecisionEventQuery {
  /** Filter by agent IDs */
  agent_ids?: string[];

  /** Filter by decision types */
  decision_types?: DecisionType[];

  /** Time range filter */
  time_range?: {
    start: string; // ISO 8601
    end: string;   // ISO 8601
  };

  /** Minimum confidence threshold */
  min_confidence?: number;

  /** Pagination */
  limit?: number;
  offset?: number;

  /** Sort order */
  order_by?: 'timestamp' | 'confidence';
  order_direction?: 'asc' | 'desc';
}

/**
 * Query result with pagination
 */
export interface QueryResult<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

/**
 * Write result
 */
export interface WriteResult {
  success: boolean;
  event_id: string;
  written_at: string;
}

/**
 * Batch write result
 */
export interface BatchWriteResult {
  success: boolean;
  total: number;
  written: number;
  failed: number;
  errors?: Array<{
    event_id: string;
    error: string;
  }>;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms: number;
  version: string;
  timestamp: string;
}
