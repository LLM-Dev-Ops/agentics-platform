/**
 * Decision Memo Generator
 *
 * Core synthesis logic for generating structured decision memos
 * from aggregated DecisionEvents.
 */

import { v4 as uuidv4 } from 'uuid';
import type { DecisionEvent, SourceReference } from '@agentics/contracts';
import type {
  DecisionMemo,
  MemoSection,
  Recommendation,
  DecisionMemoOptions,
  ConfidenceResult,
} from './types.js';
import { calculateConfidence } from './confidence.js';

interface ProcessingStage {
  stage: string;
  duration_ms: number;
  items_processed: number;
}

function groupEventsByType(events: DecisionEvent[]): Map<string, DecisionEvent[]> {
  const groups = new Map<string, DecisionEvent[]>();
  for (const event of events) {
    const existing = groups.get(event.decision_type) || [];
    existing.push(event);
    groups.set(event.decision_type, existing);
  }
  return groups;
}

function extractInsights(events: DecisionEvent[]): {
  summaries: string[];
  recommendations: string[];
  risks: string[];
} {
  const summaries: string[] = [];
  const recommendations: string[] = [];
  const risks: string[] = [];

  for (const event of events) {
    if (event.outputs.summary) summaries.push(event.outputs.summary);
    if (event.outputs.recommendation) recommendations.push(event.outputs.recommendation);
    if (event.outputs.risk_level && event.outputs.risk_level !== 'low') {
      risks.push(`${event.outputs.risk_level}: ${event.outputs.summary || 'Unspecified risk'}`);
    }
  }

  return { summaries, recommendations, risks };
}

function generateSections(
  groupedEvents: Map<string, DecisionEvent[]>,
  includeEvidence: boolean
): MemoSection[] {
  const sections: MemoSection[] = [];
  const typeToTitle: Record<string, string> = {
    decision_synthesis: 'Decision Synthesis',
    conflict_resolution: 'Conflict Resolution',
    consensus_building: 'Consensus Building',
    executive_summary: 'Executive Overview',
    status_report: 'Status Report',
    risk_report: 'Risk Assessment',
    audit_report: 'Audit Findings',
    governance_memo: 'Governance Decisions',
    risk_score: 'Risk Scoring',
    tradeoff_analysis: 'Tradeoff Analysis',
    impact_assessment: 'Impact Assessment',
    compliance_check: 'Compliance Status',
  };

  for (const [decisionType, events] of groupedEvents) {
    const title = typeToTitle[decisionType] || decisionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const insights = extractInsights(events);
    const content = insights.summaries.length > 0
      ? insights.summaries.join('\n\n')
      : `Processed ${events.length} ${decisionType} events.`;

    const hasHighRisk = events.some(e => e.outputs.risk_level === 'high' || e.outputs.risk_level === 'critical');
    const priority = hasHighRisk ? 'high' : 'medium';

    const section: MemoSection = { title, content, priority };

    if (includeEvidence) {
      section.evidence = events.slice(0, 5).map(e => ({
        source_event_id: e.event_id,
        excerpt: e.outputs.summary || JSON.stringify(e.outputs.data || {}).slice(0, 200),
        relevance: e.confidence,
      }));
    }

    sections.push(section);
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  sections.sort((a, b) =>
    (priorityOrder[a.priority || 'medium'] || 2) - (priorityOrder[b.priority || 'medium'] || 2)
  );

  return sections;
}

function generateRecommendations(
  events: DecisionEvent[],
  maxRecommendations: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const seenActions = new Set<string>();
  const sortedEvents = [...events].sort((a, b) => b.confidence - a.confidence);

  for (const event of sortedEvents) {
    if (recommendations.length >= maxRecommendations) break;

    if (event.outputs.recommendation) {
      const action = event.outputs.recommendation;
      if (seenActions.has(action.toLowerCase().slice(0, 50))) continue;
      seenActions.add(action.toLowerCase().slice(0, 50));

      let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium';
      if (event.outputs.risk_level === 'critical') priority = 'critical';
      else if (event.outputs.risk_level === 'high') priority = 'high';
      else if (event.confidence >= 0.8) priority = 'high';
      else if (event.confidence < 0.5) priority = 'low';

      recommendations.push({
        id: `rec-${uuidv4().slice(0, 8)}`,
        action,
        rationale: event.outputs.summary || 'Based on analysis of decision events.',
        priority,
      });
    }
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

function calculateRiskSummary(events: DecisionEvent[]): DecisionMemo['risk_summary'] {
  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  const keyRisks: string[] = [];
  const mitigations: string[] = [];

  for (const event of events) {
    const level = event.outputs.risk_level;
    if (level) {
      riskCounts[level]++;
      if ((level === 'high' || level === 'critical') && event.outputs.summary) {
        keyRisks.push(event.outputs.summary);
      }
    }

    for (const constraint of event.constraints_applied.constraints) {
      if (constraint.mitigation) mitigations.push(constraint.mitigation);
    }
  }

  let overallLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (riskCounts.critical > 0) overallLevel = 'critical';
  else if (riskCounts.high > 2) overallLevel = 'high';
  else if (riskCounts.high > 0 || riskCounts.medium > 3) overallLevel = 'medium';

  return {
    overall_level: overallLevel,
    key_risks: [...new Set(keyRisks)].slice(0, 5),
    mitigations: [...new Set(mitigations)].slice(0, 5),
  };
}

function generateExecutiveSummary(
  events: DecisionEvent[],
  sections: MemoSection[],
  recommendations: Recommendation[],
  riskSummary: DecisionMemo['risk_summary']
): string {
  const parts: string[] = [];

  parts.push(`This memo synthesizes ${events.length} decision events into actionable governance recommendations.`);
  parts.push(`Overall risk assessment: ${riskSummary.overall_level.toUpperCase()}.`);

  if (riskSummary.key_risks.length > 0) {
    parts.push(`Key risks identified: ${riskSummary.key_risks.slice(0, 3).join('; ')}.`);
  }

  const criticalRecs = recommendations.filter(r => r.priority === 'critical');
  const highRecs = recommendations.filter(r => r.priority === 'high');

  if (criticalRecs.length > 0) {
    parts.push(`${criticalRecs.length} critical recommendation(s) require immediate attention.`);
  }
  if (highRecs.length > 0) {
    parts.push(`${highRecs.length} high-priority recommendation(s) should be addressed promptly.`);
  }

  const criticalSections = sections.filter(s => s.priority === 'critical' || s.priority === 'high');
  if (criticalSections.length > 0) {
    parts.push(`Key areas: ${criticalSections.map(s => s.title).join(', ')}.`);
  }

  return parts.join(' ');
}

export interface MemoGenerationResult {
  memo: DecisionMemo;
  sourceReferences: SourceReference[];
  confidence: ConfidenceResult;
  stages: ProcessingStage[];
}

export async function generateDecisionMemo(
  sourceEvents: DecisionEvent[],
  options: DecisionMemoOptions = {}
): Promise<MemoGenerationResult> {
  const stages: ProcessingStage[] = [];
  const minConfidence = options.min_confidence_threshold ?? 0.5;

  // Stage 1: Filter by confidence
  const filterStart = Date.now();
  const filteredEvents = sourceEvents.filter(e => e.confidence >= minConfidence);
  const filteredCount = sourceEvents.length - filteredEvents.length;
  stages.push({
    stage: 'filter_by_confidence',
    duration_ms: Date.now() - filterStart,
    items_processed: sourceEvents.length,
  });

  // Stage 2: Group by type
  const groupStart = Date.now();
  const groupedEvents = groupEventsByType(filteredEvents);
  stages.push({
    stage: 'group_by_type',
    duration_ms: Date.now() - groupStart,
    items_processed: filteredEvents.length,
  });

  // Stage 3: Generate sections
  const sectionsStart = Date.now();
  const includeEvidence = options.include_evidence ?? true;
  const sections = generateSections(groupedEvents, includeEvidence);
  stages.push({
    stage: 'generate_sections',
    duration_ms: Date.now() - sectionsStart,
    items_processed: groupedEvents.size,
  });

  // Stage 4: Generate recommendations
  const recsStart = Date.now();
  const maxRecommendations = options.max_recommendations ?? 10;
  const recommendations = generateRecommendations(filteredEvents, maxRecommendations);
  stages.push({
    stage: 'generate_recommendations',
    duration_ms: Date.now() - recsStart,
    items_processed: filteredEvents.length,
  });

  // Stage 5: Calculate risk summary
  const riskStart = Date.now();
  const riskSummary = calculateRiskSummary(filteredEvents);
  stages.push({
    stage: 'calculate_risk',
    duration_ms: Date.now() - riskStart,
    items_processed: filteredEvents.length,
  });

  // Stage 6: Generate executive summary
  const summaryStart = Date.now();
  const executiveSummary = generateExecutiveSummary(filteredEvents, sections, recommendations, riskSummary);
  stages.push({
    stage: 'generate_summary',
    duration_ms: Date.now() - summaryStart,
    items_processed: 1,
  });

  // Determine time range
  let timeRange: { start: string; end: string } | undefined;
  if (filteredEvents.length > 0) {
    const timestamps = filteredEvents.map(e => new Date(e.timestamp).getTime());
    timeRange = {
      start: new Date(Math.min(...timestamps)).toISOString(),
      end: new Date(Math.max(...timestamps)).toISOString(),
    };
  }

  // Build memo
  const memo: DecisionMemo = {
    memo_id: uuidv4(),
    title: options.title || 'Decision Memo',
    executive_summary: executiveSummary,
    sections,
    recommendations,
    risk_summary: riskSummary,
    metadata: {
      generated_at: new Date().toISOString(),
      source_event_count: filteredEvents.length,
      time_range: timeRange,
      governance_category: options.governance_category,
    },
  };

  // Calculate confidence
  const confidence = calculateConfidence({
    sourceEvents: filteredEvents,
    processedCount: filteredEvents.length,
    filteredCount,
    totalCount: sourceEvents.length,
    memo,
  });

  // Create source references
  const sourceReferences: SourceReference[] = filteredEvents.map(event => ({
    event_id: event.event_id,
    agent_id: event.agent_id,
    decision_type: event.decision_type,
    timestamp: event.timestamp,
  }));

  return { memo, sourceReferences, confidence, stages };
}
