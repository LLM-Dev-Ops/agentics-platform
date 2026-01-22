/**
 * Decision Synthesis Logic
 *
 * Core synthesis algorithms for the Decision Agent.
 */

import type {
  DecisionEvent,
  ConstraintsApplied,
  Constraint,
} from '@agentics/contracts';
import { mergeConstraints, createDefaultConstraints } from '@agentics/contracts';

/**
 * Conflict detection result
 */
export interface ConflictDetection {
  hasConflicts: boolean;
  conflicts: Array<{
    type: 'recommendation' | 'risk_level' | 'confidence' | 'decision_type';
    events: string[]; // event IDs
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

/**
 * Synthesis result
 */
export interface SynthesisResult {
  recommendation: string;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  constraints: ConstraintsApplied;
  conflictsResolved: number;
  eventsProcessed: number;
}

/**
 * Detect conflicts between source events
 */
export function detectConflicts(events: DecisionEvent[]): ConflictDetection {
  const conflicts: ConflictDetection['conflicts'] = [];

  // Group events by decision type
  const byType = new Map<string, DecisionEvent[]>();
  for (const event of events) {
    const existing = byType.get(event.decision_type) ?? [];
    existing.push(event);
    byType.set(event.decision_type, existing);
  }

  // Check for conflicting recommendations within same type
  for (const [type, typeEvents] of byType) {
    if (typeEvents.length < 2) continue;

    const recommendations = typeEvents
      .map(e => e.outputs.recommendation)
      .filter(Boolean);

    const uniqueRecs = new Set(recommendations);
    if (uniqueRecs.size > 1) {
      conflicts.push({
        type: 'recommendation',
        events: typeEvents.map(e => e.event_id),
        description: `Conflicting recommendations in ${type} events`,
        severity: 'high',
      });
    }

    // Check for conflicting risk levels
    const riskLevels = typeEvents
      .map(e => e.outputs.risk_level)
      .filter(Boolean);

    const uniqueRisks = new Set(riskLevels);
    if (uniqueRisks.size > 1) {
      conflicts.push({
        type: 'risk_level',
        events: typeEvents.map(e => e.event_id),
        description: `Conflicting risk levels in ${type} events`,
        severity: 'medium',
      });
    }
  }

  // Check for significant confidence divergence
  const confidences = events.map(e => e.confidence);
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const maxDivergence = Math.max(...confidences.map(c => Math.abs(c - avgConfidence)));

  if (maxDivergence > 0.3) {
    conflicts.push({
      type: 'confidence',
      events: events.map(e => e.event_id),
      description: 'Significant confidence divergence across events',
      severity: 'low',
    });
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Calculate weighted confidence from source events
 */
export function calculateWeightedConfidence(events: DecisionEvent[]): number {
  if (events.length === 0) return 0;

  // Weight by recency and original confidence
  const now = Date.now();
  let totalWeight = 0;
  let weightedSum = 0;

  for (const event of events) {
    const eventTime = new Date(event.timestamp).getTime();
    const ageHours = (now - eventTime) / (1000 * 60 * 60);

    // Decay factor: more recent events have higher weight
    const recencyWeight = Math.exp(-ageHours / 24); // 24-hour half-life

    const weight = recencyWeight * event.confidence;
    weightedSum += event.confidence * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Determine overall risk level from source events
 */
export function synthesizeRiskLevel(
  events: DecisionEvent[]
): 'low' | 'medium' | 'high' | 'critical' {
  const riskLevels = events
    .map(e => e.outputs.risk_level)
    .filter((r): r is 'low' | 'medium' | 'high' | 'critical' => r !== undefined);

  if (riskLevels.length === 0) return 'low';

  // Use most severe risk level
  const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  const maxRisk = Math.max(...riskLevels.map(r => riskOrder[r]));

  const reverseOrder = { 4: 'critical', 3: 'high', 2: 'medium', 1: 'low' } as const;
  return reverseOrder[maxRisk as keyof typeof reverseOrder];
}

/**
 * Synthesize recommendation from source events
 */
export function synthesizeRecommendation(
  events: DecisionEvent[],
  conflicts: ConflictDetection
): string {
  const recommendations = events
    .map(e => e.outputs.recommendation)
    .filter(Boolean);

  if (recommendations.length === 0) {
    return 'No actionable recommendation available from source events.';
  }

  if (!conflicts.hasConflicts) {
    // No conflicts - consolidate recommendations
    const uniqueRecs = [...new Set(recommendations)];
    if (uniqueRecs.length === 1) {
      return uniqueRecs[0]!;
    }
    return `Consolidated recommendation: ${uniqueRecs.join('; ')}`;
  }

  // Has conflicts - note them in recommendation
  const conflictSummary = conflicts.conflicts
    .map(c => c.description)
    .join(', ');

  return `Recommendation with noted conflicts (${conflictSummary}): ${recommendations[0]}. Manual review recommended.`;
}

/**
 * Synthesize summary from source events
 */
export function synthesizeSummary(
  events: DecisionEvent[],
  conflicts: ConflictDetection,
  result: Partial<SynthesisResult>
): string {
  const lines: string[] = [];

  lines.push(`Synthesized ${events.length} source event(s).`);

  if (conflicts.hasConflicts) {
    lines.push(`Resolved ${conflicts.conflicts.length} conflict(s).`);
  }

  lines.push(`Overall confidence: ${((result.confidence ?? 0) * 100).toFixed(1)}%.`);
  lines.push(`Risk level: ${result.riskLevel ?? 'unknown'}.`);

  return lines.join(' ');
}

/**
 * Merge constraints from source events
 */
export function synthesizeConstraints(events: DecisionEvent[]): ConstraintsApplied {
  if (events.length === 0) {
    return createDefaultConstraints();
  }

  const allConstraints = events.map(e => e.constraints_applied);
  const merged = mergeConstraints(...allConstraints);

  // Add synthesis-specific constraints
  const synthesisConstraint: Constraint = {
    type: 'scope_limit',
    description: `Synthesis based on ${events.length} source events`,
    impact: 'low',
  };

  return {
    ...merged,
    constraints: [...merged.constraints, synthesisConstraint],
    assumptions: [
      ...merged.assumptions,
      'Source events are authoritative and complete',
      'No new information available since source event creation',
    ],
  };
}

/**
 * Perform full synthesis of source events
 */
export function synthesizeDecision(events: DecisionEvent[]): SynthesisResult {
  // Detect conflicts
  const conflicts = detectConflicts(events);

  // Calculate synthesized values
  const confidence = calculateWeightedConfidence(events);
  const riskLevel = synthesizeRiskLevel(events);
  const recommendation = synthesizeRecommendation(events, conflicts);
  const constraints = synthesizeConstraints(events);

  // Apply confidence penalty for conflicts
  const conflictPenalty = conflicts.conflicts.reduce((penalty, c) => {
    switch (c.severity) {
      case 'high': return penalty + 0.15;
      case 'medium': return penalty + 0.08;
      case 'low': return penalty + 0.03;
      default: return penalty;
    }
  }, 0);

  const adjustedConfidence = Math.max(0.1, confidence - conflictPenalty);

  const result: SynthesisResult = {
    recommendation,
    summary: '',
    riskLevel,
    confidence: adjustedConfidence,
    constraints,
    conflictsResolved: conflicts.conflicts.length,
    eventsProcessed: events.length,
  };

  result.summary = synthesizeSummary(events, conflicts, result);

  return result;
}
