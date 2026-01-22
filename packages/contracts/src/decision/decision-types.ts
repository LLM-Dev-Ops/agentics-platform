/**
 * Decision Type Definitions
 *
 * Canonical types for decision classification across the platform.
 */

import { z } from 'zod';

/**
 * Decision synthesis types for synthesis agents
 */
export const synthesisDecisionTypes = [
  'decision_synthesis',      // Aggregate multiple events into actionable recommendation
  'conflict_resolution',     // Resolve conflicts between upstream events
  'consensus_building',      // Build consensus from divergent signals
] as const;

/**
 * Executive reporting types for reporting agents
 */
export const executiveDecisionTypes = [
  'executive_summary',       // High-level executive summary
  'status_report',          // System status report
  'risk_report',            // Risk assessment report
  'audit_report',           // Compliance/audit report
  'governance_memo',        // Governance decision memo
] as const;

/**
 * Risk scoring types for scoring agents
 */
export const riskDecisionTypes = [
  'risk_score',             // Quantified risk assessment
  'tradeoff_analysis',      // Tradeoff quantification
  'impact_assessment',      // Impact analysis
  'compliance_check',       // Compliance verification
] as const;

/**
 * All valid decision types
 */
export const allDecisionTypes = [
  ...synthesisDecisionTypes,
  ...executiveDecisionTypes,
  ...riskDecisionTypes,
] as const;

/**
 * Decision type schema
 */
export const decisionTypeSchema = z.enum(allDecisionTypes);
export type DecisionType = z.infer<typeof decisionTypeSchema>;

/**
 * Check if a decision type is a synthesis type
 */
export function isSynthesisDecision(type: DecisionType): boolean {
  return (synthesisDecisionTypes as readonly string[]).includes(type);
}

/**
 * Check if a decision type is an executive type
 */
export function isExecutiveDecision(type: DecisionType): boolean {
  return (executiveDecisionTypes as readonly string[]).includes(type);
}

/**
 * Check if a decision type is a risk type
 */
export function isRiskDecision(type: DecisionType): boolean {
  return (riskDecisionTypes as readonly string[]).includes(type);
}

/**
 * Agent classification based on decision type
 */
export type AgentClassification =
  | 'DECISION_SYNTHESIS'
  | 'EXECUTIVE_REPORTING'
  | 'RISK_SCORING';

/**
 * Get agent classification from decision type
 */
export function getAgentClassification(type: DecisionType): AgentClassification {
  if (isSynthesisDecision(type)) return 'DECISION_SYNTHESIS';
  if (isExecutiveDecision(type)) return 'EXECUTIVE_REPORTING';
  return 'RISK_SCORING';
}
