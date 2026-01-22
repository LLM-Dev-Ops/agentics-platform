/**
 * Confidence Calculation Logic
 *
 * Calculates confidence scores for decision memo generation.
 */

import type { DecisionEvent } from '@agentics/contracts';
import type { DecisionMemo, MemoSection, Recommendation, ConfidenceResult } from './types.js';

const CONFIDENCE_WEIGHTS = {
  SOURCE_COVERAGE: 0.25,
  SOURCE_QUALITY: 0.25,
  EVIDENCE_STRENGTH: 0.20,
  RECOMMENDATION_SUPPORT: 0.15,
  RECENCY: 0.15,
} as const;

function calculateCoverageScore(
  processedCount: number,
  filteredCount: number,
  totalCount: number
): number {
  if (totalCount === 0) return 0;
  const usageRatio = processedCount / totalCount;
  const filterPenalty = filteredCount / totalCount * 0.2;
  return Math.max(0, Math.min(1, usageRatio - filterPenalty));
}

function calculateSourceQualityScore(sourceEvents: DecisionEvent[]): number {
  if (sourceEvents.length === 0) return 0;
  const avgConfidence = sourceEvents.reduce((sum, e) => sum + e.confidence, 0) / sourceEvents.length;
  return avgConfidence;
}

function calculateEvidenceStrength(sections: MemoSection[]): number {
  if (sections.length === 0) return 0;

  let totalRelevance = 0;
  let evidenceCount = 0;

  for (const section of sections) {
    if (section.evidence && section.evidence.length > 0) {
      for (const ev of section.evidence) {
        totalRelevance += ev.relevance;
        evidenceCount++;
      }
    }
  }

  if (evidenceCount === 0) return 0.5;
  return totalRelevance / evidenceCount;
}

function calculateRecommendationSupport(
  recommendations: Recommendation[],
  sourceEvents: DecisionEvent[]
): number {
  if (recommendations.length === 0) return 1;
  if (sourceEvents.length === 0) return 0;

  let supportedCount = 0;
  const sourceOutputs = sourceEvents.map(e => JSON.stringify(e.outputs).toLowerCase());

  for (const rec of recommendations) {
    const recText = `${rec.action} ${rec.rationale}`.toLowerCase();
    if (sourceOutputs.some(output => {
      const words = recText.split(/\s+/).filter(w => w.length > 4);
      return words.some(word => output.includes(word));
    })) {
      supportedCount++;
    }
  }

  return supportedCount / recommendations.length;
}

function calculateRecencyScore(sourceEvents: DecisionEvent[]): number {
  if (sourceEvents.length === 0) return 0;

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const ONE_WEEK_MS = 7 * ONE_DAY_MS;
  const ONE_MONTH_MS = 30 * ONE_DAY_MS;

  let totalRecency = 0;
  for (const event of sourceEvents) {
    const eventTime = new Date(event.timestamp).getTime();
    const ageMs = now - eventTime;

    if (ageMs < ONE_DAY_MS) totalRecency += 1.0;
    else if (ageMs < ONE_WEEK_MS) totalRecency += 0.8;
    else if (ageMs < ONE_MONTH_MS) totalRecency += 0.5;
    else totalRecency += 0.2;
  }

  return totalRecency / sourceEvents.length;
}

export interface ConfidenceContext {
  sourceEvents: DecisionEvent[];
  processedCount: number;
  filteredCount: number;
  totalCount: number;
  memo: DecisionMemo;
}

export function calculateConfidence(context: ConfidenceContext): ConfidenceResult {
  const { sourceEvents, processedCount, filteredCount, totalCount, memo } = context;

  const coverage = calculateCoverageScore(processedCount, filteredCount, totalCount);
  const sourceQuality = calculateSourceQualityScore(sourceEvents);
  const evidenceStrength = calculateEvidenceStrength(memo.sections);
  const recommendationSupport = calculateRecommendationSupport(memo.recommendations, sourceEvents);
  const recency = calculateRecencyScore(sourceEvents);

  const overall =
    coverage * CONFIDENCE_WEIGHTS.SOURCE_COVERAGE +
    sourceQuality * CONFIDENCE_WEIGHTS.SOURCE_QUALITY +
    evidenceStrength * CONFIDENCE_WEIGHTS.EVIDENCE_STRENGTH +
    recommendationSupport * CONFIDENCE_WEIGHTS.RECOMMENDATION_SUPPORT +
    recency * CONFIDENCE_WEIGHTS.RECENCY;

  const components = {
    coverage,
    source_quality: sourceQuality,
    evidence_strength: evidenceStrength,
    recommendation_support: recommendationSupport,
    recency,
  };

  const weakestComponent = Object.entries(components).reduce((min, [key, value]) =>
    value < min.value ? { key, value } : min,
    { key: '', value: 1 }
  );

  let explanation = `Confidence ${(overall * 100).toFixed(1)}%: `;
  if (overall >= 0.8) {
    explanation += 'High confidence based on comprehensive source coverage and strong evidence.';
  } else if (overall >= 0.6) {
    explanation += `Moderate confidence. ${weakestComponent.key.replace('_', ' ')} could be improved.`;
  } else if (overall >= 0.4) {
    explanation += `Low-moderate confidence. Limited by ${weakestComponent.key.replace('_', ' ')}.`;
  } else {
    explanation += `Low confidence. Significant gaps in ${weakestComponent.key.replace('_', ' ')}.`;
  }

  return {
    overall: Math.round(overall * 1000) / 1000,
    components,
    explanation,
  };
}

export function confidenceToRiskLevel(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
  if (confidence >= 0.8) return 'low';
  if (confidence >= 0.6) return 'medium';
  if (confidence >= 0.4) return 'high';
  return 'critical';
}
