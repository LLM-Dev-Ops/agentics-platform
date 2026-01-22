/**
 * Decision Memo Agent Types
 *
 * Type definitions for the Decision Memo Agent.
 * Uses @agentics/contracts for base types.
 */

import { z } from 'zod';

/**
 * Memo section schema
 */
export const memoSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  evidence: z.array(z.object({
    source_event_id: z.string().uuid(),
    excerpt: z.string(),
    relevance: z.number().min(0).max(1),
  })).optional(),
});
export type MemoSection = z.infer<typeof memoSectionSchema>;

/**
 * Recommendation schema
 */
export const recommendationSchema = z.object({
  id: z.string(),
  action: z.string(),
  rationale: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  effort: z.enum(['trivial', 'small', 'medium', 'large', 'epic']).optional(),
  dependencies: z.array(z.string()).optional(),
  deadline: z.string().datetime().optional(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

/**
 * Decision memo schema
 */
export const decisionMemoSchema = z.object({
  memo_id: z.string().uuid(),
  title: z.string(),
  executive_summary: z.string(),
  sections: z.array(memoSectionSchema),
  recommendations: z.array(recommendationSchema),
  risk_summary: z.object({
    overall_level: z.enum(['low', 'medium', 'high', 'critical']),
    key_risks: z.array(z.string()),
    mitigations: z.array(z.string()),
  }),
  metadata: z.object({
    generated_at: z.string().datetime(),
    source_event_count: z.number().int().nonnegative(),
    time_range: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }).optional(),
    governance_category: z.string().optional(),
  }),
});
export type DecisionMemo = z.infer<typeof decisionMemoSchema>;

/**
 * Agent-specific input options
 */
export interface DecisionMemoOptions {
  title?: string;
  governance_category?: string;
  include_evidence?: boolean;
  max_recommendations?: number;
  min_confidence_threshold?: number;
  audience?: 'executive' | 'technical' | 'compliance' | 'general';
}

/**
 * Confidence calculation result
 */
export interface ConfidenceResult {
  overall: number;
  components: {
    coverage: number;
    source_quality: number;
    evidence_strength: number;
    recommendation_support: number;
    recency: number;
  };
  explanation: string;
}
