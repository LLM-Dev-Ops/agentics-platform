/**
 * Risk Scoring Agent Implementation
 *
 * PROMPT 2 Implementation: Runtime and infrastructure.
 *
 * Classification: RISK SCORING
 * Decision Type: risk_score
 *
 * This agent:
 * - Aggregates DecisionEvents across repositories
 * - Evaluates risk signals
 * - Computes normalized risk scores
 * - Emits risk assessments
 *
 * This agent MUST NOT:
 * - Execute inference
 * - Modify prompts or responses
 * - Route requests
 * - Trigger orchestration
 * - Apply optimizations
 * - Enforce governance actions automatically
 * - Connect directly to Google SQL
 * - Execute SQL directly
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
import { AgentValidationError } from '../base/errors.js';
import {
  RISK_SCORING_AGENT_CONTRACT,
  type RiskCategory,
  type RiskMethodology,
  RISK_CATEGORIES,
  RISK_METHODOLOGIES,
} from './contract.js';

/**
 * Risk Scoring Agent Input
 */
export interface RiskScoringAgentInput extends AgentInput {
  /** Risk categories to evaluate */
  risk_categories?: RiskCategory[];

  /** Risk scoring methodology */
  methodology?: RiskMethodology;

  /** Custom risk weights per category (must sum to 1.0) */
  custom_weights?: Record<string, number>;

  /** Threshold for high-risk flagging (0-100) */
  high_risk_threshold?: number;

  /** Minimum confidence threshold for source events */
  min_confidence?: number;
}

/**
 * Risk Scoring Agent Output
 */
export interface RiskScoringAgentOutput extends AgentOutput {
  /** Detailed scoring result */
  scoring: {
    overall_score: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    category_scores: Record<string, {
      score: number;
      level: 'low' | 'medium' | 'high' | 'critical';
      contributing_factors: string[];
    }>;
    top_risks: Array<{
      risk_id: string;
      category: string;
      description: string;
      score: number;
      mitigation_suggestions: string[];
    }>;
    risk_trend: 'improving' | 'stable' | 'worsening';
  };
}

/**
 * Risk signal extracted from DecisionEvents
 */
interface RiskSignal {
  source: string;
  category: RiskCategory;
  severity: number;
  description: string;
  timestamp: string;
}

/**
 * Default category weights
 */
const DEFAULT_CATEGORY_WEIGHTS: Record<RiskCategory, number> = {
  security: 0.20,
  operational: 0.15,
  financial: 0.15,
  compliance: 0.15,
  technical_debt: 0.10,
  availability: 0.15,
  data_integrity: 0.10,
};

/**
 * Risk level thresholds
 */
const RISK_LEVEL_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 100,
};

/**
 * Risk Scoring Agent
 *
 * Assesses and scores platform-level risks based on aggregated
 * operational, financial, and technical signals.
 */
export class RiskScoringAgent extends BaseAgent<RiskScoringAgentInput, RiskScoringAgentOutput> {
  public readonly agentId = 'risk-scoring-agent';
  public readonly agentVersion = '0.1.0';
  public readonly contract: AgentContract = RISK_SCORING_AGENT_CONTRACT;
  public readonly decisionType: DecisionType = 'risk_score';

  constructor(config: AgentConfig) {
    super(config);
  }

  /**
   * Validate input
   */
  protected override async validateInput(
    input: RiskScoringAgentInput,
    context: AgentContext
  ): Promise<void> {
    await super.validateInput(input, context);

    // Validate risk categories
    if (input.risk_categories?.length) {
      for (const category of input.risk_categories) {
        if (!RISK_CATEGORIES.includes(category)) {
          throw new AgentValidationError(
            `Invalid risk category: ${category}`,
            this.agentId,
            [{ field: 'risk_categories', message: `Valid categories: ${RISK_CATEGORIES.join(', ')}` }],
            context.correlationId
          );
        }
      }
    }

    // Validate methodology
    if (input.methodology && !RISK_METHODOLOGIES.includes(input.methodology)) {
      throw new AgentValidationError(
        `Invalid methodology: ${input.methodology}`,
        this.agentId,
        [{ field: 'methodology', message: `Valid methodologies: ${RISK_METHODOLOGIES.join(', ')}` }],
        context.correlationId
      );
    }

    // Validate custom weights
    if (input.custom_weights) {
      const total = Object.values(input.custom_weights).reduce((a, b) => a + b, 0);
      if (Math.abs(total - 1.0) > 0.001) {
        // Auto-normalize instead of error (as per failure modes)
        const factor = 1.0 / total;
        for (const key of Object.keys(input.custom_weights)) {
          input.custom_weights[key] *= factor;
        }
      }

      for (const [key, value] of Object.entries(input.custom_weights)) {
        if (value < 0 || value > 1) {
          throw new AgentValidationError(
            `Invalid weight for ${key}: ${value}`,
            this.agentId,
            [{ field: `custom_weights.${key}`, message: 'Weight must be between 0 and 1' }],
            context.correlationId
          );
        }
      }
    }

    // Validate threshold
    if (input.high_risk_threshold !== undefined) {
      if (input.high_risk_threshold < 0 || input.high_risk_threshold > 100) {
        throw new AgentValidationError(
          'high_risk_threshold must be between 0 and 100',
          this.agentId,
          [{ field: 'high_risk_threshold', message: 'Must be between 0 and 100' }],
          context.correlationId
        );
      }
    }

    // Validate confidence threshold
    if (input.min_confidence !== undefined) {
      if (input.min_confidence < 0 || input.min_confidence > 1) {
        throw new AgentValidationError(
          'min_confidence must be between 0 and 1',
          this.agentId,
          [{ field: 'min_confidence', message: 'Must be between 0 and 1' }],
          context.correlationId
        );
      }
    }
  }

  /**
   * Execute risk scoring analysis
   */
  protected override async execute(
    input: RiskScoringAgentInput,
    sourceEvents: DecisionEvent[],
    context: AgentContext
  ): Promise<{
    outputs: OutputPayload;
    confidence: number;
    constraints: ConstraintsApplied;
    summary?: string;
  }> {
    // Assert boundaries
    this.assertBoundary(
      sourceEvents.every(e => e.event_id !== undefined),
      'Source events must have valid event IDs',
      context
    );

    // Filter by confidence if specified
    let filteredEvents = sourceEvents;
    if (input.min_confidence !== undefined) {
      filteredEvents = sourceEvents.filter(e => e.confidence >= input.min_confidence!);
    }

    // Determine configuration
    const categories = input.risk_categories ?? [...RISK_CATEGORIES];
    const methodology = input.methodology ?? 'hybrid';
    const weights = this.mergeWeights(input.custom_weights, categories);
    const threshold = input.high_risk_threshold ?? 70;

    // Extract risk signals from events
    const signals = this.extractRiskSignals(filteredEvents);

    // Compute category scores
    const categoryScores = this.computeCategoryScores(signals, categories, methodology);

    // Compute overall score
    const overallScore = this.computeOverallScore(categoryScores, weights);

    // Determine risk level
    const riskLevel = this.getRiskLevel(overallScore);

    // Identify top risks
    const topRisks = this.identifyTopRisks(signals, threshold);

    // Compute trend
    const riskTrend = this.computeRiskTrend(signals);

    // Build output payload
    const outputs: OutputPayload = {
      score: overallScore,
      risk_level: riskLevel,
      summary: this.buildSummary(overallScore, riskLevel, riskTrend, topRisks.length),
      recommendation: this.buildRecommendation(riskLevel, topRisks),
      data: {
        overall_risk_score: overallScore,
        risk_level: riskLevel,
        category_scores: categoryScores,
        top_risks: topRisks,
        risk_trend: riskTrend,
        events_analyzed: filteredEvents.length,
        signals_extracted: signals.length,
        methodology,
        categories_evaluated: categories,
      },
    };

    // Build constraints
    const constraints: ConstraintsApplied = {
      assumptions: [
        'Risk signals derived from aggregated DecisionEvents',
        `Scoring methodology: ${methodology}`,
        'Trend analysis requires minimum 2 signals',
      ],
      scope_limits: [
        `Analyzed ${filteredEvents.length} source events`,
        `Processed ${signals.length} risk signals`,
      ],
      constraints: [
        {
          type: 'scope_limit',
          description: `Analyzed ${filteredEvents.length} source events`,
          impact: 'medium',
        },
        {
          type: 'scope_limit',
          description: `Processed ${signals.length} risk signals`,
          impact: 'medium',
        },
        {
          type: 'assumption',
          description: `Categories evaluated: ${categories.join(', ')}`,
          impact: 'low',
        },
      ],
      data_sources: ['ruvector-service', 'decision_events_collection'],
      dependencies: [],
    };

    // Compute confidence
    const confidence = this.computeConfidence(signals, filteredEvents);

    return {
      outputs,
      confidence,
      constraints,
      summary: outputs.summary,
    };
  }

  /**
   * Merge custom weights with defaults
   */
  private mergeWeights(
    customWeights: Record<string, number> | undefined,
    categories: RiskCategory[]
  ): Record<string, number> {
    const weights: Record<string, number> = {};

    for (const category of categories) {
      weights[category] = customWeights?.[category] ?? DEFAULT_CATEGORY_WEIGHTS[category];
    }

    // Normalize to sum to 1
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(weights)) {
      weights[key] = weights[key] / total;
    }

    return weights;
  }

  /**
   * Extract risk signals from DecisionEvents
   */
  private extractRiskSignals(events: DecisionEvent[]): RiskSignal[] {
    const signals: RiskSignal[] = [];

    for (const event of events) {
      // Extract from outputs data if available
      if (event.outputs.data) {
        const data = event.outputs.data as Record<string, unknown>;

        // Check for explicit risk data
        if (data.risks && Array.isArray(data.risks)) {
          for (const risk of data.risks as Array<{ category?: string; severity?: number; description?: string }>) {
            if (risk.category && RISK_CATEGORIES.includes(risk.category as RiskCategory)) {
              signals.push({
                source: event.agent_id,
                category: risk.category as RiskCategory,
                severity: risk.severity ?? 50,
                description: risk.description ?? 'Unspecified risk',
                timestamp: event.timestamp,
              });
            }
          }
        }

        // Check for risk_level in outputs
        if (event.outputs.risk_level) {
          const riskLevelMapping: Record<string, number> = {
            low: 25,
            medium: 50,
            high: 75,
            critical: 95,
          };
          const severity = riskLevelMapping[event.outputs.risk_level] ?? 50;

          signals.push({
            source: event.agent_id,
            category: 'operational',
            severity,
            description: event.outputs.summary ?? `Risk from ${event.agent_id}`,
            timestamp: event.timestamp,
          });
        }
      }

      // Extract signals from recommendations
      if (event.outputs.recommendation) {
        const signal = this.parseRecommendationToSignal(event.outputs.recommendation, event);
        if (signal) {
          signals.push(signal);
        }
      }
    }

    return signals;
  }

  /**
   * Parse a recommendation string into a risk signal
   */
  private parseRecommendationToSignal(recommendation: string, event: DecisionEvent): RiskSignal | null {
    const lower = recommendation.toLowerCase();
    let category: RiskCategory | null = null;
    let severity = 50;

    // Detect category from keywords
    if (lower.includes('security') || lower.includes('vulnerab')) {
      category = 'security';
      if (lower.includes('critical')) severity = 90;
      else if (lower.includes('high')) severity = 75;
    } else if (lower.includes('cost') || lower.includes('budget') || lower.includes('financial')) {
      category = 'financial';
      if (lower.includes('exceed') || lower.includes('over')) severity = 70;
    } else if (lower.includes('compliance') || lower.includes('regulation')) {
      category = 'compliance';
      if (lower.includes('violation')) severity = 85;
    } else if (lower.includes('availability') || lower.includes('uptime') || lower.includes('outage')) {
      category = 'availability';
      if (lower.includes('outage')) severity = 80;
    }

    if (!category) return null;

    return {
      source: event.agent_id,
      category,
      severity,
      description: recommendation.substring(0, 200),
      timestamp: event.timestamp,
    };
  }

  /**
   * Compute scores for each risk category
   */
  private computeCategoryScores(
    signals: RiskSignal[],
    categories: RiskCategory[],
    methodology: RiskMethodology
  ): Record<string, { score: number; level: 'low' | 'medium' | 'high' | 'critical'; contributing_factors: string[] }> {
    const scores: Record<string, { score: number; level: 'low' | 'medium' | 'high' | 'critical'; contributing_factors: string[] }> = {};

    for (const category of categories) {
      const categorySignals = signals.filter(s => s.category === category);
      const score = this.computeCategoryScore(categorySignals, methodology);
      const level = this.getRiskLevel(score);
      const contributingFactors = categorySignals
        .filter(s => s.severity > 30)
        .map(s => s.description)
        .slice(0, 5);

      scores[category] = {
        score: Math.round(score * 100) / 100,
        level,
        contributing_factors: contributingFactors,
      };
    }

    return scores;
  }

  /**
   * Compute score for a single category
   */
  private computeCategoryScore(signals: RiskSignal[], methodology: RiskMethodology): number {
    if (signals.length === 0) return 0;

    switch (methodology) {
      case 'quantitative': {
        // Weighted average with density factor
        const avgSeverity = signals.reduce((sum, s) => sum + s.severity, 0) / signals.length;
        const densityFactor = Math.min(1 + signals.length * 0.05, 1.5);
        return Math.min(avgSeverity * densityFactor, 100);
      }

      case 'qualitative': {
        // Categorical assessment based on severity distribution
        let critical = 0, high = 0, medium = 0, low = 0;
        for (const s of signals) {
          if (s.severity >= 75) critical++;
          else if (s.severity >= 50) high++;
          else if (s.severity >= 25) medium++;
          else low++;
        }
        return Math.min((critical * 100 + high * 75 + medium * 50 + low * 25) / signals.length, 100);
      }

      case 'hybrid':
      default: {
        const quant = this.computeCategoryScore(signals, 'quantitative');
        const qual = this.computeCategoryScore(signals, 'qualitative');
        return quant * 0.6 + qual * 0.4;
      }
    }
  }

  /**
   * Compute overall risk score from category scores
   */
  private computeOverallScore(
    categoryScores: Record<string, { score: number }>,
    weights: Record<string, number>
  ): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [category, { score }] of Object.entries(categoryScores)) {
      const weight = weights[category] ?? 0;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
  }

  /**
   * Determine risk level from score
   */
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score < RISK_LEVEL_THRESHOLDS.low) return 'low';
    if (score < RISK_LEVEL_THRESHOLDS.medium) return 'medium';
    if (score < RISK_LEVEL_THRESHOLDS.high) return 'high';
    return 'critical';
  }

  /**
   * Identify top risk items
   */
  private identifyTopRisks(
    signals: RiskSignal[],
    threshold: number
  ): Array<{ risk_id: string; category: string; description: string; score: number; mitigation_suggestions: string[] }> {
    const highRiskSignals = signals
      .filter(s => s.severity >= threshold)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 10);

    return highRiskSignals.map((signal, index) => ({
      risk_id: `RISK-${Date.now()}-${index}`,
      category: signal.category,
      description: signal.description,
      score: signal.severity,
      mitigation_suggestions: this.generateMitigationSuggestions(signal.category),
    }));
  }

  /**
   * Generate mitigation suggestions
   */
  private generateMitigationSuggestions(category: RiskCategory): string[] {
    const suggestions: Record<RiskCategory, string[]> = {
      security: ['Review access control policies', 'Audit security configurations', 'Implement additional monitoring'],
      operational: ['Review operational procedures', 'Implement redundancy measures', 'Update runbooks'],
      financial: ['Analyze cost drivers', 'Implement budget alerts', 'Review resource utilization'],
      compliance: ['Review compliance requirements', 'Update documentation', 'Schedule compliance audit'],
      technical_debt: ['Prioritize debt reduction', 'Allocate refactoring time', 'Update technical roadmap'],
      availability: ['Review SLA targets', 'Implement failover mechanisms', 'Enhance monitoring'],
      data_integrity: ['Implement data validation', 'Review backup procedures', 'Audit data pipelines'],
    };
    return suggestions[category]?.slice(0, 3) ?? [];
  }

  /**
   * Compute risk trend from temporal analysis
   */
  private computeRiskTrend(signals: RiskSignal[]): 'improving' | 'stable' | 'worsening' {
    if (signals.length < 2) return 'stable';

    const sorted = [...signals].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    const firstAvg = firstHalf.reduce((sum, s) => sum + s.severity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.severity, 0) / secondHalf.length;

    const delta = secondAvg - firstAvg;
    if (delta < -5) return 'improving';
    if (delta > 5) return 'worsening';
    return 'stable';
  }

  /**
   * Compute confidence score
   */
  private computeConfidence(signals: RiskSignal[], events: DecisionEvent[]): number {
    let confidence = 0.5;

    // Signal bonus (up to 0.25)
    confidence += Math.min(signals.length / 100, 0.25);

    // Event bonus (up to 0.15)
    confidence += Math.min(events.length / 500, 0.15);

    // Source confidence bonus
    if (events.length > 0) {
      const avgSourceConfidence = events.reduce((sum, e) => sum + e.confidence, 0) / events.length;
      confidence += avgSourceConfidence * 0.1;
    }

    return Math.min(Math.round(confidence * 100) / 100, 0.99);
  }

  /**
   * Build summary text
   */
  private buildSummary(
    score: number,
    level: 'low' | 'medium' | 'high' | 'critical',
    trend: 'improving' | 'stable' | 'worsening',
    topRiskCount: number
  ): string {
    let summary = `Platform risk assessment: ${level.toUpperCase()} (score: ${score}/100). `;
    if (trend !== 'stable') {
      summary += `Risk trend is ${trend}. `;
    }
    if (topRiskCount > 0) {
      summary += `${topRiskCount} high-priority risks identified.`;
    } else {
      summary += 'No high-priority risks identified.';
    }
    return summary;
  }

  /**
   * Build recommendation
   */
  private buildRecommendation(
    level: 'low' | 'medium' | 'high' | 'critical',
    topRisks: Array<{ mitigation_suggestions: string[] }>
  ): string {
    const recommendations: string[] = [];

    // Aggregate mitigation suggestions
    const allMitigations = topRisks.flatMap(r => r.mitigation_suggestions);
    const uniqueMitigations = [...new Set(allMitigations)].slice(0, 5);
    recommendations.push(...uniqueMitigations);

    if (level === 'critical') {
      recommendations.push('Escalate to executive leadership for immediate action');
    } else if (level === 'high') {
      recommendations.push('Schedule risk review meeting with stakeholders');
    }

    return recommendations.join('; ');
  }
}

/**
 * Create a Risk Scoring Agent instance
 */
export function createRiskScoringAgent(config: AgentConfig): RiskScoringAgent {
  return new RiskScoringAgent(config);
}
