/**
 * Executive Summary Agent Implementation
 *
 * PROMPT 2 Implementation: Runtime and infrastructure.
 *
 * Classification: EXECUTIVE REPORTING
 * Decision Type: executive_summary
 *
 * Purpose:
 * Produce concise, executive-grade summaries of platform state, risks, and decisions.
 * Translate technical outputs into executive language.
 *
 * This agent MUST NOT:
 * - Execute inference
 * - Modify upstream systems
 * - Enforce decisions
 * - Trigger orchestration
 * - Connect directly to databases
 */

import type {
  DecisionEvent,
  DecisionType,
  AgentContract,
  ConstraintsApplied,
  OutputPayload,
} from '@agentics/contracts';
import { BaseAgent, type AgentInput, type AgentOutput, type AgentConfig } from '../base/agent.js';
import type { AgentContext } from '../base/context.js';
import { EXECUTIVE_SUMMARY_AGENT_CONTRACT } from './contract.js';

/**
 * Focus areas for executive summaries
 */
export type ExecutiveFocusArea =
  | 'platform_health'
  | 'security_posture'
  | 'cost_efficiency'
  | 'performance'
  | 'compliance'
  | 'risk_overview'
  | 'capacity_planning';

/**
 * Executive Summary Agent Input
 */
export interface ExecutiveSummaryInput extends AgentInput {
  /** Focus areas for the summary */
  focus_areas?: ExecutiveFocusArea[];
  /** Maximum length of summary (characters) */
  max_summary_length?: number;
  /** Audience level */
  audience_level?: 'executive' | 'technical' | 'operational';
}

/**
 * Platform status assessment
 */
export interface PlatformStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  component_statuses: Record<string, 'healthy' | 'degraded' | 'critical'>;
}

/**
 * Executive Summary Agent Output
 */
export interface ExecutiveSummaryOutput extends AgentOutput {
  /** Platform status */
  platform_status: PlatformStatus;
  /** Key metrics snapshot */
  metrics_snapshot: Record<string, number | string>;
  /** Top concerns */
  top_concerns: Array<{
    area: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  /** Trends */
  trends: Array<{
    metric: string;
    direction: 'improving' | 'stable' | 'declining';
    change_percent?: number;
  }>;
}

/**
 * Executive Summary Agent
 *
 * Produces executive-grade summaries of platform state.
 */
export class ExecutiveSummaryAgent extends BaseAgent<ExecutiveSummaryInput, ExecutiveSummaryOutput> {
  public readonly agentId = 'executive-summary-agent';
  public readonly agentVersion = '0.1.0';
  public readonly contract: AgentContract = EXECUTIVE_SUMMARY_AGENT_CONTRACT;
  public readonly decisionType: DecisionType = 'executive_summary';

  constructor(config: AgentConfig) {
    super(config);
  }

  /**
   * Execute summary generation
   */
  protected override async execute(
    input: ExecutiveSummaryInput,
    sourceEvents: DecisionEvent[],
    _context: AgentContext
  ): Promise<{
    outputs: OutputPayload;
    confidence: number;
    constraints: ConstraintsApplied;
    summary?: string;
  }> {
    // Determine focus areas
    const focusAreas = input.focus_areas ?? [
      'platform_health',
      'security_posture',
      'risk_overview',
    ];

    // Assess platform status
    const platformStatus = this.assessPlatformStatus(sourceEvents);

    // Aggregate metrics
    const metricsSnapshot = this.aggregateMetrics(sourceEvents);

    // Identify top concerns
    const topConcerns = this.identifyTopConcerns(sourceEvents);

    // Analyze trends
    const trends = this.analyzeTrends(sourceEvents);

    // Generate summary text
    const summaryText = this.generateSummaryText(
      platformStatus,
      topConcerns,
      trends,
      input.audience_level ?? 'executive',
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(sourceEvents);

    // Build constraints
    const constraints: ConstraintsApplied = {
      assumptions: [
        'Data retrieved from ruvector-service is accurate and up-to-date',
      ],
      scope_limits: [
        `Analysis limited to ${focusAreas.length} focus areas`,
        `Based on ${sourceEvents.length} recent DecisionEvents`,
      ],
      constraints: [
        {
          type: 'assumption',
          description: 'Data retrieved from ruvector-service is accurate and up-to-date',
          impact: 'medium',
        },
        {
          type: 'scope_limit',
          description: `Analysis limited to ${focusAreas.length} focus areas`,
          impact: 'low',
        },
        {
          type: 'data_availability',
          description: `Based on ${sourceEvents.length} recent DecisionEvents`,
          impact: sourceEvents.length < 10 ? 'high' : 'low',
        },
      ],
      data_sources: ['ruvector-service'],
      dependencies: [
        {
          service: 'ruvector-service',
          status: 'available',
          fallback_used: false,
        },
      ],
    };

    // Build output payload
    const outputs: OutputPayload = {
      summary: summaryText,
      risk_level: platformStatus.overall === 'critical' ? 'critical' :
                  platformStatus.overall === 'degraded' ? 'medium' : 'low',
      data: {
        platform_status: platformStatus,
        metrics_snapshot: metricsSnapshot,
        top_concerns: topConcerns,
        trends,
        focus_areas: focusAreas,
        events_analyzed: sourceEvents.length,
      },
    };

    return {
      outputs,
      confidence,
      constraints,
      summary: summaryText,
    };
  }

  /**
   * Assess overall platform status
   */
  private assessPlatformStatus(events: DecisionEvent[]): PlatformStatus {
    const avgConfidence = events.length > 0
      ? events.reduce((sum, e) => sum + e.confidence, 0) / events.length
      : 0;

    const criticalEvents = events.filter(
      e => e.decision_type === 'risk_score' && e.confidence < 0.5,
    );

    let overall: 'healthy' | 'degraded' | 'critical';
    if (criticalEvents.length > 5 || avgConfidence < 0.3) {
      overall = 'critical';
    } else if (criticalEvents.length > 0 || avgConfidence < 0.6) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      component_statuses: {
        intelligence: avgConfidence >= 0.7 ? 'healthy' : 'degraded',
        governance: criticalEvents.length === 0 ? 'healthy' : 'degraded',
        data: events.length >= 10 ? 'healthy' : 'degraded',
      },
    };
  }

  /**
   * Aggregate metrics from events
   */
  private aggregateMetrics(events: DecisionEvent[]): Record<string, number | string> {
    return {
      total_events: events.length,
      avg_confidence: events.length > 0
        ? (events.reduce((sum, e) => sum + e.confidence, 0) / events.length).toFixed(2)
        : '0.00',
      high_confidence_events: events.filter(e => e.confidence >= 0.8).length,
      low_confidence_events: events.filter(e => e.confidence < 0.5).length,
      unique_agents: new Set(events.map(e => e.agent_id)).size,
    };
  }

  /**
   * Identify top concerns
   */
  private identifyTopConcerns(
    events: DecisionEvent[],
  ): Array<{ area: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string }> {
    const concerns: Array<{ area: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string }> = [];

    const lowConfidenceCount = events.filter(e => e.confidence < 0.5).length;
    if (lowConfidenceCount > 0) {
      concerns.push({
        area: 'Decision Quality',
        severity: lowConfidenceCount > 10 ? 'high' : 'medium',
        description: `${lowConfidenceCount} events have confidence below 50%`,
      });
    }

    const riskEvents = events.filter(e => e.decision_type === 'risk_score');
    if (riskEvents.length > 0) {
      concerns.push({
        area: 'Risk Management',
        severity: riskEvents.length > 5 ? 'high' : 'low',
        description: `${riskEvents.length} risk assessments require attention`,
      });
    }

    if (events.length < 10) {
      concerns.push({
        area: 'Data Availability',
        severity: 'medium',
        description: 'Limited data available for comprehensive analysis',
      });
    }

    return concerns.slice(0, 5);
  }

  /**
   * Analyze trends
   */
  private analyzeTrends(
    events: DecisionEvent[],
  ): Array<{ metric: string; direction: 'improving' | 'stable' | 'declining'; change_percent?: number }> {
    const trends: Array<{ metric: string; direction: 'improving' | 'stable' | 'declining'; change_percent?: number }> = [];

    if (events.length < 2) {
      return [{ metric: 'confidence', direction: 'stable' }];
    }

    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

    const firstAvg = firstHalf.reduce((sum, e) => sum + e.confidence, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, e) => sum + e.confidence, 0) / secondHalf.length;

    const changePercent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    trends.push({
      metric: 'confidence',
      direction: changePercent > 5 ? 'improving' : changePercent < -5 ? 'declining' : 'stable',
      change_percent: Math.round(changePercent * 100) / 100,
    });

    return trends;
  }

  /**
   * Generate summary text
   */
  private generateSummaryText(
    status: PlatformStatus,
    concerns: Array<{ area: string; severity: string; description: string }>,
    trends: Array<{ metric: string; direction: string }>,
    audienceLevel: 'executive' | 'technical' | 'operational',
  ): string {
    const parts: string[] = [];

    const statusText = {
      healthy: 'operating within normal parameters',
      degraded: 'experiencing some degradation',
      critical: 'requiring immediate attention',
    }[status.overall];

    if (audienceLevel === 'executive') {
      parts.push(`Platform Status: The platform is currently ${statusText}.`);
    } else {
      parts.push(`System Status: ${status.overall.toUpperCase()} - ${statusText}.`);
    }

    const highConcerns = concerns.filter(c => c.severity === 'high' || c.severity === 'critical');
    if (highConcerns.length > 0) {
      parts.push(`Key Concerns: ${highConcerns.map(c => c.description).join('; ')}`);
    }

    const improvingTrends = trends.filter(t => t.direction === 'improving');
    if (improvingTrends.length > 0) {
      parts.push(`Positive Trends: ${improvingTrends.map(t => t.metric).join(', ')} showing improvement.`);
    }

    return parts.join(' ');
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(events: DecisionEvent[]): number {
    if (events.length === 0) {
      return 0.3;
    }

    let confidence = 0.5;

    if (events.length >= 50) confidence += 0.2;
    else if (events.length >= 20) confidence += 0.1;

    const avgEventConfidence = events.reduce((sum, e) => sum + e.confidence, 0) / events.length;
    confidence += avgEventConfidence * 0.2;

    return Math.min(Math.max(confidence, 0), 0.95);
  }
}

/**
 * Create an Executive Summary Agent instance
 */
export function createExecutiveSummaryAgent(config: AgentConfig): ExecutiveSummaryAgent {
  return new ExecutiveSummaryAgent(config);
}
