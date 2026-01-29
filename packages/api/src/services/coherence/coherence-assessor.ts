/**
 * Coherence Assessor Service
 *
 * Implements ADR/DDD #005: System Coherence Domain
 *
 * The Coherence Assessor combines all coherence services to provide
 * comprehensive system coherence assessment. It:
 *
 * - Coordinates drift detection across all domains
 * - Validates system invariants
 * - Produces coherence reports for human review
 * - NEVER automatically corrects findings
 *
 * This is the primary entry point for coherence operations.
 */

import { randomUUID } from 'crypto';
import type {
  CoherenceAssessment,
  CoherenceSummary,
  AssessmentScope,
  DriftFinding,
} from '@agentics/shared';
import { CoherenceStatus, DriftSeverity, DriftType } from '@agentics/shared';

import { DriftDetector, getDriftDetector } from './drift-detector.js';
import { LineageTracker, getLineageTracker } from './lineage-tracker.js';
import { InvariantValidator, getInvariantValidator } from './invariant-validator.js';
import { HumanOversightService, getHumanOversightService } from './human-oversight.js';

/**
 * Configuration for coherence assessment
 */
export interface CoherenceAssessorConfig {
  /** Threshold for degraded status (0-1) */
  degradedThreshold: number;
  /** Threshold for incoherent status (0-1) */
  incoherentThreshold: number;
  /** Whether to include integration checks by default */
  defaultIncludeIntegrations: boolean;
  /** Whether to include ERP Surface checks by default */
  defaultIncludeErpSurface: boolean;
}

/**
 * Coherence Assessor Service
 *
 * Provides comprehensive coherence assessment by coordinating
 * all coherence-related services.
 */
export class CoherenceAssessor {
  private readonly config: CoherenceAssessorConfig;
  private readonly driftDetector: DriftDetector;
  private readonly lineageTracker: LineageTracker;
  private readonly invariantValidator: InvariantValidator;
  private readonly humanOversight: HumanOversightService;

  private readonly assessmentHistory: CoherenceAssessment[] = [];
  private readonly maxHistorySize = 100;

  constructor(config: Partial<CoherenceAssessorConfig> = {}) {
    this.config = {
      degradedThreshold: 0.9,
      incoherentThreshold: 0.7,
      defaultIncludeIntegrations: true,
      defaultIncludeErpSurface: true,
      ...config,
    };

    this.driftDetector = getDriftDetector();
    this.lineageTracker = getLineageTracker();
    this.invariantValidator = getInvariantValidator();
    this.humanOversight = getHumanOversightService();
  }

  /**
   * Perform a comprehensive coherence assessment
   *
   * @param scope - What to assess
   * @param userId - User initiating the assessment
   * @param correlationId - Correlation ID for traceability
   */
  async assess(
    scope: Partial<AssessmentScope>,
    userId: string,
    correlationId: string
  ): Promise<CoherenceAssessment> {
    const startTime = Date.now();
    const assessmentId = randomUUID();

    const fullScope: AssessmentScope = {
      componentTypes: scope.componentTypes || ['all'],
      componentIds: scope.componentIds,
      timeRange: scope.timeRange,
      includeIntegrations: scope.includeIntegrations ?? this.config.defaultIncludeIntegrations,
      includeErpSurface: scope.includeErpSurface ?? this.config.defaultIncludeErpSurface,
    };

    // Collect all drift findings
    const driftFindings: DriftFinding[] = [];

    // Get existing unacknowledged findings
    const existingFindings = this.driftDetector.getUnacknowledgedFindings();
    driftFindings.push(...existingFindings);

    // Calculate summary statistics
    const summary = this.calculateSummary(driftFindings, startTime);

    // Determine overall status
    const status = this.determineStatus(summary.coherenceScore);

    const assessment: CoherenceAssessment = {
      assessmentId,
      timestamp: new Date().toISOString(),
      status,
      driftFindings,
      summary,
      scope: fullScope,
      correlationId,
      initiatedBy: userId,
    };

    // Store in history
    this.assessmentHistory.push(assessment);
    while (this.assessmentHistory.length > this.maxHistorySize) {
      this.assessmentHistory.shift();
    }

    // Surface critical findings to human oversight
    await this.surfaceCriticalFindings(driftFindings, correlationId);

    return assessment;
  }

  /**
   * Get the current coherence status without full assessment
   */
  getQuickStatus(): {
    status: CoherenceStatus;
    unacknowledgedDrift: number;
    pendingDecisions: number;
    criticalAlerts: number;
  } {
    const unacknowledgedDrift = this.driftDetector.getUnacknowledgedFindings().length;
    const pendingDecisions = this.humanOversight.getPendingDecisions().length;
    const criticalAlerts = this.humanOversight
      .getAlertsBySeverity(DriftSeverity.CRITICAL)
      .filter(a => !a.acknowledged).length;

    let status: CoherenceStatus;
    if (criticalAlerts > 0 || unacknowledgedDrift > 10) {
      status = CoherenceStatus.INCOHERENT;
    } else if (unacknowledgedDrift > 0 || pendingDecisions > 5) {
      status = CoherenceStatus.DEGRADED;
    } else {
      status = CoherenceStatus.COHERENT;
    }

    return {
      status,
      unacknowledgedDrift,
      pendingDecisions,
      criticalAlerts,
    };
  }

  /**
   * Get assessment history
   */
  getAssessmentHistory(limit?: number): CoherenceAssessment[] {
    const history = [...this.assessmentHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get a specific assessment by ID
   */
  getAssessment(assessmentId: string): CoherenceAssessment | undefined {
    return this.assessmentHistory.find(a => a.assessmentId === assessmentId);
  }

  /**
   * Get the latest assessment
   */
  getLatestAssessment(): CoherenceAssessment | undefined {
    return this.assessmentHistory[this.assessmentHistory.length - 1];
  }

  /**
   * Get aggregate statistics across all coherence services
   */
  getStatistics(): {
    drift: ReturnType<DriftDetector['getStatistics']>;
    lineage: ReturnType<LineageTracker['getStatistics']>;
    invariants: ReturnType<InvariantValidator['getStatistics']>;
    oversight: ReturnType<HumanOversightService['getStatistics']>;
    assessments: {
      total: number;
      lastAssessment: string | undefined;
    };
  } {
    return {
      drift: this.driftDetector.getStatistics(),
      lineage: this.lineageTracker.getStatistics(),
      invariants: this.invariantValidator.getStatistics(),
      oversight: this.humanOversight.getStatistics(),
      assessments: {
        total: this.assessmentHistory.length,
        lastAssessment: this.assessmentHistory.length > 0
          ? this.assessmentHistory[this.assessmentHistory.length - 1].timestamp
          : undefined,
      },
    };
  }

  /**
   * Get all system invariants with their current status
   */
  getInvariantStatus(): ReturnType<InvariantValidator['getInvariants']> {
    return this.invariantValidator.getInvariants();
  }

  /**
   * Access to underlying services for direct operations
   */
  get drift(): DriftDetector {
    return this.driftDetector;
  }

  get lineage(): LineageTracker {
    return this.lineageTracker;
  }

  get invariants(): InvariantValidator {
    return this.invariantValidator;
  }

  get oversight(): HumanOversightService {
    return this.humanOversight;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Calculate summary statistics from drift findings
   */
  private calculateSummary(
    findings: DriftFinding[],
    startTime: number
  ): CoherenceSummary {
    const findingsBySeverity = {
      [DriftSeverity.INFO]: 0,
      [DriftSeverity.WARNING]: 0,
      [DriftSeverity.CRITICAL]: 0,
    };

    const findingsByType = {
      [DriftType.SEMANTIC]: 0,
      [DriftType.STRUCTURAL]: 0,
      [DriftType.LINEAGE]: 0,
      [DriftType.INTEGRATION]: 0,
    };

    for (const finding of findings) {
      findingsBySeverity[finding.severity]++;
      findingsByType[finding.type]++;
    }

    // Calculate coherence score (1.0 = fully coherent, 0.0 = completely incoherent)
    // Weight critical findings more heavily
    const weightedScore =
      findingsBySeverity[DriftSeverity.CRITICAL] * 10 +
      findingsBySeverity[DriftSeverity.WARNING] * 3 +
      findingsBySeverity[DriftSeverity.INFO] * 1;

    // Normalize to 0-1 range (higher = more coherent)
    const coherenceScore = Math.max(0, 1 - weightedScore / 100);

    return {
      componentsAssessed: findings.length > 0 ? findings.length : 1,
      findingsBySeverity,
      findingsByType,
      coherenceScore,
      assessmentDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Determine overall status from coherence score
   */
  private determineStatus(coherenceScore: number): CoherenceStatus {
    if (coherenceScore >= this.config.degradedThreshold) {
      return CoherenceStatus.COHERENT;
    } else if (coherenceScore >= this.config.incoherentThreshold) {
      return CoherenceStatus.DEGRADED;
    } else {
      return CoherenceStatus.INCOHERENT;
    }
  }

  /**
   * Surface critical findings to human oversight
   */
  private async surfaceCriticalFindings(
    findings: DriftFinding[],
    correlationId: string
  ): Promise<void> {
    for (const finding of findings) {
      if (
        finding.severity === DriftSeverity.CRITICAL &&
        !finding.acknowledged
      ) {
        this.humanOversight.surfaceDriftFinding(
          finding.id,
          finding.description,
          finding.severity,
          correlationId
        );
      }
    }
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.driftDetector.clearFindings();
    this.lineageTracker.clear();
    this.invariantValidator.clear();
    this.humanOversight.clear();
    this.assessmentHistory.length = 0;
  }
}

// Singleton instance
let coherenceAssessorInstance: CoherenceAssessor | null = null;

/**
 * Get the coherence assessor instance
 */
export function getCoherenceAssessor(
  config?: Partial<CoherenceAssessorConfig>
): CoherenceAssessor {
  if (!coherenceAssessorInstance) {
    coherenceAssessorInstance = new CoherenceAssessor(config);
  }
  return coherenceAssessorInstance;
}

/**
 * Reset the coherence assessor (for testing)
 */
export function resetCoherenceAssessor(): void {
  coherenceAssessorInstance = null;
}
