/**
 * Constraints Schema
 *
 * Defines assumptions, scope limits, and constraints applied during decision-making.
 */

import { z } from 'zod';

/**
 * Individual constraint definition
 */
export const constraintSchema = z.object({
  type: z.enum([
    'assumption',           // Assumption made during processing
    'scope_limit',         // Limitation in scope of analysis
    'data_availability',   // Data availability constraint
    'time_bound',          // Time-based constraint
    'dependency',          // Dependency on external system
    'confidence_threshold', // Minimum confidence requirement
    'regulatory',          // Regulatory constraint
    'resource',            // Resource constraint
  ]),
  description: z.string(),
  impact: z.enum(['low', 'medium', 'high']),
  mitigation: z.string().optional(),
});
export type Constraint = z.infer<typeof constraintSchema>;

/**
 * Constraints applied during decision-making
 */
export const constraintsAppliedSchema = z.object({
  /**
   * Assumptions made during analysis
   */
  assumptions: z.array(z.string()).default([]),

  /**
   * Scope limitations
   */
  scope_limits: z.array(z.string()).default([]),

  /**
   * Detailed constraints
   */
  constraints: z.array(constraintSchema).default([]),

  /**
   * Data sources considered
   */
  data_sources: z.array(z.string()).default([]),

  /**
   * Time window of analysis (ISO 8601 duration)
   */
  analysis_window: z.string().optional(),

  /**
   * External dependencies
   */
  dependencies: z.array(z.object({
    service: z.string(),
    status: z.enum(['available', 'degraded', 'unavailable']),
    fallback_used: z.boolean(),
  })).default([]),
});

export type ConstraintsApplied = z.infer<typeof constraintsAppliedSchema>;

/**
 * Create default constraints
 */
export function createDefaultConstraints(): ConstraintsApplied {
  return {
    assumptions: [],
    scope_limits: [],
    constraints: [],
    data_sources: [],
    dependencies: [],
  };
}

/**
 * Merge multiple constraints
 */
export function mergeConstraints(...constraints: ConstraintsApplied[]): ConstraintsApplied {
  return {
    assumptions: [...new Set(constraints.flatMap(c => c.assumptions))],
    scope_limits: [...new Set(constraints.flatMap(c => c.scope_limits))],
    constraints: constraints.flatMap(c => c.constraints),
    data_sources: [...new Set(constraints.flatMap(c => c.data_sources))],
    analysis_window: constraints.find(c => c.analysis_window)?.analysis_window,
    dependencies: constraints.flatMap(c => c.dependencies),
  };
}
