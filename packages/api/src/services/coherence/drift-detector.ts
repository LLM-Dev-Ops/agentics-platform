/**
 * Drift Detection Service
 *
 * Implements ADR/DDD #005: System Coherence, Drift Detection, and Self-Governance
 *
 * CRITICAL: This service detects drift but NEVER corrects it automatically.
 * All drift findings are recorded and surfaced to human operators (INV-C3).
 *
 * Drift Types Detected:
 * - Semantic: Meaning changes without acknowledgment
 * - Structural: Relationships diverge from declared architecture
 * - Lineage: Historical records become inconsistent
 * - Integration: External systems evolve invalidating contracts
 */

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import type {
  DriftFinding,
  DriftSource,
  DriftState,
  DriftType,
  DriftSeverity,
} from '@agentics/shared';
import {
  DriftType as DriftTypeEnum,
  DriftSeverity as DriftSeverityEnum,
} from '@agentics/shared';

/**
 * Configuration for drift detection
 */
export interface DriftDetectorConfig {
  /** Enable semantic drift detection */
  detectSemantic: boolean;
  /** Enable structural drift detection */
  detectStructural: boolean;
  /** Enable lineage drift detection */
  detectLineage: boolean;
  /** Enable integration drift detection */
  detectIntegration: boolean;
}

/**
 * Context for a drift detection operation
 */
export interface DriftDetectionContext {
  /** Correlation ID for traceability */
  correlationId: string;
  /** User ID initiating the detection */
  userId: string;
  /** Scope of detection */
  scope?: string[];
}

/**
 * Drift Detection Service
 *
 * Provides mechanisms to detect divergence between expected and actual system state.
 * Findings are recorded and surfaced but never automatically corrected.
 */
export class DriftDetector {
  private readonly config: DriftDetectorConfig;
  private readonly findings: Map<string, DriftFinding> = new Map();

  constructor(config: Partial<DriftDetectorConfig> = {}) {
    this.config = {
      detectSemantic: true,
      detectStructural: true,
      detectLineage: true,
      detectIntegration: true,
      ...config,
    };
  }

  /**
   * Compare two states and detect drift
   *
   * @param expected - Expected state based on governance/memory
   * @param actual - Actual observed state
   * @param source - Where the potential drift was found
   * @param context - Detection context for traceability
   * @returns Array of drift findings (empty if no drift)
   */
  async detectDrift(
    expected: Record<string, unknown>,
    actual: Record<string, unknown>,
    source: DriftSource,
    context: DriftDetectionContext
  ): Promise<DriftFinding[]> {
    const findings: DriftFinding[] = [];

    // Create state representations for comparison
    const expectedState = this.createDriftState(expected, 'memory');
    const actualState = this.createDriftState(actual, 'runtime');

    // Check for state equivalence
    if (expectedState.hash === actualState.hash) {
      return []; // No drift detected
    }

    // Analyze the type of drift
    const driftAnalysis = this.analyzeDrift(expected, actual);

    for (const analysis of driftAnalysis) {
      const finding: DriftFinding = {
        id: randomUUID(),
        type: analysis.type,
        severity: analysis.severity,
        description: analysis.description,
        source,
        expected: expectedState,
        actual: actualState,
        detectedAt: new Date().toISOString(),
        correlationId: context.correlationId,
        governanceReference: analysis.governanceReference,
        acknowledged: false,
      };

      // Record the finding (INV-C3: detect but never silently correct)
      this.findings.set(finding.id, finding);
      findings.push(finding);
    }

    return findings;
  }

  /**
   * Detect semantic drift in contract definitions
   */
  async detectSemanticDrift(
    contractId: string,
    currentDefinition: Record<string, unknown>,
    storedDefinition: Record<string, unknown>,
    context: DriftDetectionContext
  ): Promise<DriftFinding[]> {
    if (!this.config.detectSemantic) {
      return [];
    }

    const source: DriftSource = {
      sourceType: 'contract',
      sourceId: contractId,
      name: `Contract: ${contractId}`,
    };

    return this.detectDrift(storedDefinition, currentDefinition, source, context);
  }

  /**
   * Detect structural drift in component relationships
   */
  async detectStructuralDrift(
    componentId: string,
    declaredDependencies: string[],
    actualDependencies: string[],
    context: DriftDetectionContext
  ): Promise<DriftFinding[]> {
    if (!this.config.detectStructural) {
      return [];
    }

    const source: DriftSource = {
      sourceType: 'component',
      sourceId: componentId,
      name: `Component: ${componentId}`,
    };

    const expected = { dependencies: declaredDependencies.sort() };
    const actual = { dependencies: actualDependencies.sort() };

    return this.detectDrift(expected, actual, source, context);
  }

  /**
   * Detect lineage drift in artifact derivation
   */
  async detectLineageDrift(
    artifactId: string,
    recordedLineage: Record<string, unknown>,
    computedLineage: Record<string, unknown>,
    context: DriftDetectionContext
  ): Promise<DriftFinding[]> {
    if (!this.config.detectLineage) {
      return [];
    }

    const source: DriftSource = {
      sourceType: 'artifact',
      sourceId: artifactId,
      name: `Artifact: ${artifactId}`,
    };

    return this.detectDrift(recordedLineage, computedLineage, source, context);
  }

  /**
   * Detect integration drift in external system connections
   */
  async detectIntegrationDrift(
    integrationId: string,
    contractState: Record<string, unknown>,
    runtimeState: Record<string, unknown>,
    context: DriftDetectionContext
  ): Promise<DriftFinding[]> {
    if (!this.config.detectIntegration) {
      return [];
    }

    const source: DriftSource = {
      sourceType: 'integration',
      sourceId: integrationId,
      name: `Integration: ${integrationId}`,
    };

    return this.detectDrift(contractState, runtimeState, source, context);
  }

  /**
   * Get all unacknowledged drift findings
   */
  getUnacknowledgedFindings(): DriftFinding[] {
    return Array.from(this.findings.values()).filter(f => !f.acknowledged);
  }

  /**
   * Get findings by severity
   */
  getFindingsBySeverity(severity: DriftSeverity): DriftFinding[] {
    return Array.from(this.findings.values()).filter(f => f.severity === severity);
  }

  /**
   * Get findings by type
   */
  getFindingsByType(type: DriftType): DriftFinding[] {
    return Array.from(this.findings.values()).filter(f => f.type === type);
  }

  /**
   * Get a specific finding by ID
   */
  getFinding(findingId: string): DriftFinding | undefined {
    return this.findings.get(findingId);
  }

  /**
   * Acknowledge a drift finding (human action required)
   *
   * IMPORTANT: Acknowledgment does NOT correct the drift.
   * It only records that a human has reviewed it.
   */
  acknowledgeFinding(
    findingId: string,
    userId: string
  ): DriftFinding | undefined {
    const finding = this.findings.get(findingId);
    if (!finding) {
      return undefined;
    }

    // Record acknowledgment (not correction)
    finding.acknowledged = true;
    finding.acknowledgedBy = userId;
    finding.acknowledgedAt = new Date().toISOString();

    return finding;
  }

  /**
   * Get statistics about current drift findings
   */
  getStatistics(): {
    total: number;
    unacknowledged: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  } {
    const findings = Array.from(this.findings.values());

    const bySeverity: Record<string, number> = {
      [DriftSeverityEnum.INFO]: 0,
      [DriftSeverityEnum.WARNING]: 0,
      [DriftSeverityEnum.CRITICAL]: 0,
    };

    const byType: Record<string, number> = {
      [DriftTypeEnum.SEMANTIC]: 0,
      [DriftTypeEnum.STRUCTURAL]: 0,
      [DriftTypeEnum.LINEAGE]: 0,
      [DriftTypeEnum.INTEGRATION]: 0,
    };

    for (const finding of findings) {
      bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
      byType[finding.type] = (byType[finding.type] || 0) + 1;
    }

    return {
      total: findings.length,
      unacknowledged: findings.filter(f => !f.acknowledged).length,
      bySeverity,
      byType,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create a DriftState from a value
   */
  private createDriftState(
    value: Record<string, unknown>,
    origin: DriftState['origin']
  ): DriftState {
    const hash = this.hashState(value);
    return {
      asOf: new Date().toISOString(),
      value,
      hash,
      origin,
    };
  }

  /**
   * Generate a hash for a state value
   */
  private hashState(value: Record<string, unknown>): string {
    const normalized = JSON.stringify(value, Object.keys(value).sort());
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Analyze the differences and classify drift type
   */
  private analyzeDrift(
    expected: Record<string, unknown>,
    actual: Record<string, unknown>
  ): Array<{
    type: DriftType;
    severity: DriftSeverity;
    description: string;
    governanceReference?: string;
  }> {
    const results: Array<{
      type: DriftType;
      severity: DriftSeverity;
      description: string;
      governanceReference?: string;
    }> = [];

    const expectedKeys = new Set(Object.keys(expected));
    const actualKeys = new Set(Object.keys(actual));

    // Check for added keys (potential semantic drift)
    const addedKeys = [...actualKeys].filter(k => !expectedKeys.has(k));
    if (addedKeys.length > 0) {
      results.push({
        type: DriftTypeEnum.SEMANTIC,
        severity: DriftSeverityEnum.WARNING,
        description: `Unexpected properties found: ${addedKeys.join(', ')}`,
        governanceReference: 'ADR/DDD-005:INV-C4',
      });
    }

    // Check for removed keys (potential structural drift)
    const removedKeys = [...expectedKeys].filter(k => !actualKeys.has(k));
    if (removedKeys.length > 0) {
      results.push({
        type: DriftTypeEnum.STRUCTURAL,
        severity: DriftSeverityEnum.CRITICAL,
        description: `Expected properties missing: ${removedKeys.join(', ')}`,
        governanceReference: 'ADR/DDD-005:INV-C2',
      });
    }

    // Check for modified values
    const commonKeys = [...expectedKeys].filter(k => actualKeys.has(k));
    for (const key of commonKeys) {
      const expectedValue = JSON.stringify(expected[key]);
      const actualValue = JSON.stringify(actual[key]);
      if (expectedValue !== actualValue) {
        results.push({
          type: DriftTypeEnum.SEMANTIC,
          severity: DriftSeverityEnum.WARNING,
          description: `Value changed for property '${key}'`,
          governanceReference: 'ADR/DDD-005:INV-C1',
        });
      }
    }

    // If no specific drift identified but hashes differ, record as generic
    if (results.length === 0) {
      results.push({
        type: DriftTypeEnum.SEMANTIC,
        severity: DriftSeverityEnum.INFO,
        description: 'State divergence detected without specific property changes',
      });
    }

    return results;
  }

  /**
   * Clear all findings (for testing purposes only)
   */
  clearFindings(): void {
    this.findings.clear();
  }
}

// Singleton instance
let driftDetectorInstance: DriftDetector | null = null;

/**
 * Get the drift detector instance
 */
export function getDriftDetector(config?: Partial<DriftDetectorConfig>): DriftDetector {
  if (!driftDetectorInstance) {
    driftDetectorInstance = new DriftDetector(config);
  }
  return driftDetectorInstance;
}

/**
 * Reset the drift detector (for testing)
 */
export function resetDriftDetector(): void {
  driftDetectorInstance = null;
}
