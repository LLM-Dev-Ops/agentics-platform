/**
 * Invariant Validation Service
 *
 * Implements ADR/DDD #005: System-Level Invariants
 *
 * Validates the non-negotiable architectural truths:
 * - INV-C1: Every enterprise decision must remain traceable over time
 * - INV-C2: No integration or ERP proposal exists without historical context
 * - INV-C3: Drift may be detected but never silently corrected
 * - INV-C4: Memory is authoritative; projections are derived
 * - INV-C5: Self-management never bypasses governance
 *
 * These invariants are checked, not enforced through correction.
 * Violations are surfaced to human operators.
 */

import { randomUUID } from 'crypto';
import type {
  SystemInvariant,
  InvariantValidationResult,
  InvariantViolation,
  DecisionRecord,
  LineageRecord,
} from '@agentics/shared';
import { InvariantCategory } from '@agentics/shared';

/**
 * Invariant definitions from ADR/DDD #005
 */
export const SYSTEM_INVARIANTS: SystemInvariant[] = [
  {
    invariantId: 'INV-C1',
    description: 'Every enterprise decision must remain traceable over time',
    category: InvariantCategory.TRACEABILITY,
    enforced: true,
  },
  {
    invariantId: 'INV-C2',
    description: 'No integration or ERP proposal exists without historical context',
    category: InvariantCategory.HISTORICAL_CONTEXT,
    enforced: true,
  },
  {
    invariantId: 'INV-C3',
    description: 'Drift may be detected but never silently corrected',
    category: InvariantCategory.DRIFT_HANDLING,
    enforced: true,
  },
  {
    invariantId: 'INV-C4',
    description: 'Memory is authoritative; projections are derived',
    category: InvariantCategory.MEMORY_AUTHORITY,
    enforced: true,
  },
  {
    invariantId: 'INV-C5',
    description: 'Self-management never bypasses governance',
    category: InvariantCategory.GOVERNANCE,
    enforced: true,
  },
];

/**
 * Context for invariant validation
 */
export interface ValidationContext {
  /** Correlation ID for traceability */
  correlationId: string;
  /** User ID performing validation */
  userId: string;
  /** Timestamp of validation */
  timestamp: string;
}

/**
 * Invariant Validation Service
 *
 * Validates system-level invariants without automatic correction.
 * Violations are recorded and surfaced for human review.
 */
export class InvariantValidator {
  private readonly validationHistory: Map<string, InvariantValidationResult[]> = new Map();

  /**
   * Get all defined invariants
   */
  getInvariants(): SystemInvariant[] {
    return SYSTEM_INVARIANTS.map(inv => ({
      ...inv,
      lastValidated: this.getLastValidated(inv.invariantId),
      lastValidationResult: this.getLastResult(inv.invariantId),
    }));
  }

  /**
   * Get a specific invariant by ID
   */
  getInvariant(invariantId: string): SystemInvariant | undefined {
    const invariant = SYSTEM_INVARIANTS.find(i => i.invariantId === invariantId);
    if (!invariant) {
      return undefined;
    }
    return {
      ...invariant,
      lastValidated: this.getLastValidated(invariantId),
      lastValidationResult: this.getLastResult(invariantId),
    };
  }

  /**
   * Validate INV-C1: Decision Traceability
   *
   * Checks that a decision record has all required traceability fields.
   */
  validateDecisionTraceability(
    decision: DecisionRecord,
    context: ValidationContext
  ): InvariantValidationResult {
    const violations: InvariantViolation[] = [];

    // Check for required traceability fields
    if (!decision.decisionId) {
      violations.push({
        description: 'Decision missing unique identifier',
        location: 'decisionId',
        evidence: { decision },
        detectedAt: context.timestamp,
      });
    }

    if (!decision.initiatedBy) {
      violations.push({
        description: 'Decision missing initiator (who initiated)',
        location: 'initiatedBy',
        evidence: { decisionId: decision.decisionId },
        detectedAt: context.timestamp,
      });
    }

    if (!decision.initiatedAt) {
      violations.push({
        description: 'Decision missing initiation timestamp (when)',
        location: 'initiatedAt',
        evidence: { decisionId: decision.decisionId },
        detectedAt: context.timestamp,
      });
    }

    if (!decision.context || !decision.context.applicableRules) {
      violations.push({
        description: 'Decision missing governance context (under what rules)',
        location: 'context.applicableRules',
        evidence: { decisionId: decision.decisionId },
        detectedAt: context.timestamp,
      });
    }

    if (!decision.subject || !decision.subject.proposedAction) {
      violations.push({
        description: 'Decision missing proposed action (what)',
        location: 'subject.proposedAction',
        evidence: { decisionId: decision.decisionId },
        detectedAt: context.timestamp,
      });
    }

    if (!decision.auditTrail || decision.auditTrail.length === 0) {
      violations.push({
        description: 'Decision missing audit trail',
        location: 'auditTrail',
        evidence: { decisionId: decision.decisionId },
        detectedAt: context.timestamp,
      });
    }

    const result = this.createResult('INV-C1', violations, context);
    this.recordResult('INV-C1', result);
    return result;
  }

  /**
   * Validate INV-C2: Historical Context
   *
   * Checks that a proposal has required historical context.
   */
  validateHistoricalContext(
    decision: DecisionRecord,
    context: ValidationContext
  ): InvariantValidationResult {
    const violations: InvariantViolation[] = [];

    if (!decision.historicalContext) {
      violations.push({
        description: 'Decision missing historical context entirely',
        location: 'historicalContext',
        evidence: { decisionId: decision.decisionId },
        detectedAt: context.timestamp,
      });
    } else {
      // Check for integration states if this involves integrations
      if (
        decision.category === 'policy_change' ||
        decision.category === 'erp_contract_evolution'
      ) {
        if (
          !decision.historicalContext.integrationStates ||
          decision.historicalContext.integrationStates.length === 0
        ) {
          violations.push({
            description: 'Integration-related decision missing integration state history',
            location: 'historicalContext.integrationStates',
            evidence: { decisionId: decision.decisionId, category: decision.category },
            detectedAt: context.timestamp,
          });
        }
      }

      // Check for ERP Surface version if applicable
      if (
        decision.category === 'erp_contract_evolution' &&
        !decision.historicalContext.erpSurfaceVersion
      ) {
        violations.push({
          description: 'ERP contract evolution missing ERP Surface version',
          location: 'historicalContext.erpSurfaceVersion',
          evidence: { decisionId: decision.decisionId },
          detectedAt: context.timestamp,
        });
      }

      // Check for lineage chain
      if (
        !decision.historicalContext.lineageChain ||
        decision.historicalContext.lineageChain.length === 0
      ) {
        violations.push({
          description: 'Decision missing lineage chain for historical context',
          location: 'historicalContext.lineageChain',
          evidence: { decisionId: decision.decisionId },
          detectedAt: context.timestamp,
        });
      }
    }

    const result = this.createResult('INV-C2', violations, context);
    this.recordResult('INV-C2', result);
    return result;
  }

  /**
   * Validate INV-C3: No Silent Correction
   *
   * Checks that drift findings were not silently corrected.
   * This validates the process, not runtime behavior.
   */
  validateNoSilentCorrection(
    driftFindingId: string,
    wasAcknowledged: boolean,
    wasRemediated: boolean,
    remediationAuthorizedBy: string | undefined,
    context: ValidationContext
  ): InvariantValidationResult {
    const violations: InvariantViolation[] = [];

    if (wasRemediated && !wasAcknowledged) {
      violations.push({
        description: 'Drift was remediated without prior acknowledgment',
        location: `driftFinding:${driftFindingId}`,
        evidence: { driftFindingId, wasRemediated, wasAcknowledged },
        detectedAt: context.timestamp,
      });
    }

    if (wasRemediated && !remediationAuthorizedBy) {
      violations.push({
        description: 'Drift remediation lacks human authorization',
        location: `driftFinding:${driftFindingId}`,
        evidence: { driftFindingId, remediationAuthorizedBy },
        detectedAt: context.timestamp,
      });
    }

    const result = this.createResult('INV-C3', violations, context);
    this.recordResult('INV-C3', result);
    return result;
  }

  /**
   * Validate INV-C4: Memory Authority
   *
   * Checks that projections derive from memory, not the reverse.
   */
  validateMemoryAuthority(
    memoryState: Record<string, unknown>,
    projectionState: Record<string, unknown>,
    projectionSource: string,
    context: ValidationContext
  ): InvariantValidationResult {
    const violations: InvariantViolation[] = [];

    // Check that projection does not contain data absent from memory
    const memoryKeys = new Set(Object.keys(memoryState));
    const projectionKeys = Object.keys(projectionState);

    for (const key of projectionKeys) {
      if (!memoryKeys.has(key)) {
        violations.push({
          description: `Projection contains key '${key}' not present in authoritative memory`,
          location: `projection:${projectionSource}`,
          evidence: { key, projectionSource },
          detectedAt: context.timestamp,
        });
      }
    }

    const result = this.createResult('INV-C4', violations, context);
    this.recordResult('INV-C4', result);
    return result;
  }

  /**
   * Validate INV-C5: Governance Not Bypassed
   *
   * Checks that an operation went through proper governance.
   */
  validateGovernanceNotBypassed(
    operationId: string,
    operationType: string,
    governanceChecksPerformed: string[],
    requiredChecks: string[],
    context: ValidationContext
  ): InvariantValidationResult {
    const violations: InvariantViolation[] = [];
    const performedSet = new Set(governanceChecksPerformed);

    for (const required of requiredChecks) {
      if (!performedSet.has(required)) {
        violations.push({
          description: `Required governance check '${required}' was not performed`,
          location: `operation:${operationId}`,
          evidence: { operationId, operationType, missingCheck: required },
          detectedAt: context.timestamp,
        });
      }
    }

    const result = this.createResult('INV-C5', violations, context);
    this.recordResult('INV-C5', result);
    return result;
  }

  /**
   * Validate lineage record against invariants
   */
  validateLineageRecord(
    lineage: LineageRecord,
    context: ValidationContext
  ): InvariantValidationResult {
    const violations: InvariantViolation[] = [];

    // INV-C1: Check traceability
    if (!lineage.authorizedBy) {
      violations.push({
        description: 'Lineage record missing authorization (INV-C1)',
        location: `lineage:${lineage.lineageId}`,
        evidence: { lineageId: lineage.lineageId },
        detectedAt: context.timestamp,
      });
    }

    if (!lineage.correlationId) {
      violations.push({
        description: 'Lineage record missing correlation ID (INV-C1)',
        location: `lineage:${lineage.lineageId}`,
        evidence: { lineageId: lineage.lineageId },
        detectedAt: context.timestamp,
      });
    }

    // INV-C2: Check governance context
    if (!lineage.governanceContext) {
      violations.push({
        description: 'Lineage record missing governance context (INV-C2)',
        location: `lineage:${lineage.lineageId}`,
        evidence: { lineageId: lineage.lineageId },
        detectedAt: context.timestamp,
      });
    } else if (!lineage.governanceContext.adrVersion) {
      violations.push({
        description: 'Lineage record missing ADR version reference (INV-C2)',
        location: `lineage:${lineage.lineageId}`,
        evidence: { lineageId: lineage.lineageId },
        detectedAt: context.timestamp,
      });
    }

    // Determine which invariant this falls under
    const invariantId = violations.length > 0 ? 'INV-C1' : 'INV-C2';
    const result = this.createResult(invariantId, violations, context);
    this.recordResult(invariantId, result);
    return result;
  }

  /**
   * Run all invariant validations for a comprehensive check
   */
  validateAll(
    decisions: DecisionRecord[],
    lineageRecords: LineageRecord[],
    context: ValidationContext
  ): Map<string, InvariantValidationResult> {
    const results = new Map<string, InvariantValidationResult>();

    // Validate all decisions for INV-C1 and INV-C2
    const traceabilityViolations: InvariantViolation[] = [];
    const historicalContextViolations: InvariantViolation[] = [];

    for (const decision of decisions) {
      const c1Result = this.validateDecisionTraceability(decision, context);
      traceabilityViolations.push(...c1Result.violations);

      const c2Result = this.validateHistoricalContext(decision, context);
      historicalContextViolations.push(...c2Result.violations);
    }

    results.set('INV-C1', this.createResult('INV-C1', traceabilityViolations, context));
    results.set('INV-C2', this.createResult('INV-C2', historicalContextViolations, context));

    // Validate all lineage records
    const lineageViolations: InvariantViolation[] = [];
    for (const lineage of lineageRecords) {
      const result = this.validateLineageRecord(lineage, context);
      lineageViolations.push(...result.violations);
    }

    // INV-C3, C4, C5 are validated on specific operations, not batch
    results.set('INV-C3', this.createResult('INV-C3', [], context));
    results.set('INV-C4', this.createResult('INV-C4', [], context));
    results.set('INV-C5', this.createResult('INV-C5', [], context));

    return results;
  }

  /**
   * Get validation history for an invariant
   */
  getValidationHistory(invariantId: string): InvariantValidationResult[] {
    return this.validationHistory.get(invariantId) || [];
  }

  /**
   * Get aggregate statistics across all invariants
   */
  getStatistics(): {
    totalValidations: number;
    totalViolations: number;
    violationsByInvariant: Record<string, number>;
    lastValidated: string | undefined;
  } {
    let totalValidations = 0;
    let totalViolations = 0;
    const violationsByInvariant: Record<string, number> = {};
    let lastValidated: string | undefined;

    for (const [invariantId, results] of this.validationHistory.entries()) {
      totalValidations += results.length;
      let invariantViolations = 0;

      for (const result of results) {
        invariantViolations += result.violations.length;
        if (!lastValidated || result.validatedAt > lastValidated) {
          lastValidated = result.validatedAt;
        }
      }

      totalViolations += invariantViolations;
      violationsByInvariant[invariantId] = invariantViolations;
    }

    return {
      totalValidations,
      totalViolations,
      violationsByInvariant,
      lastValidated,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create a validation result
   */
  private createResult(
    invariantId: string,
    violations: InvariantViolation[],
    context: ValidationContext
  ): InvariantValidationResult {
    return {
      valid: violations.length === 0,
      validatedAt: context.timestamp,
      violations,
      validationContext: {
        correlationId: context.correlationId,
        userId: context.userId,
        invariantId,
      },
    };
  }

  /**
   * Record a validation result
   */
  private recordResult(invariantId: string, result: InvariantValidationResult): void {
    const history = this.validationHistory.get(invariantId) || [];
    history.push(result);

    // Keep only last 100 results per invariant
    while (history.length > 100) {
      history.shift();
    }

    this.validationHistory.set(invariantId, history);
  }

  /**
   * Get last validation timestamp for an invariant
   */
  private getLastValidated(invariantId: string): string | undefined {
    const history = this.validationHistory.get(invariantId);
    if (!history || history.length === 0) {
      return undefined;
    }
    return history[history.length - 1].validatedAt;
  }

  /**
   * Get last validation result for an invariant
   */
  private getLastResult(invariantId: string): InvariantValidationResult | undefined {
    const history = this.validationHistory.get(invariantId);
    if (!history || history.length === 0) {
      return undefined;
    }
    return history[history.length - 1];
  }

  /**
   * Clear validation history (for testing)
   */
  clear(): void {
    this.validationHistory.clear();
  }
}

// Singleton instance
let invariantValidatorInstance: InvariantValidator | null = null;

/**
 * Get the invariant validator instance
 */
export function getInvariantValidator(): InvariantValidator {
  if (!invariantValidatorInstance) {
    invariantValidatorInstance = new InvariantValidator();
  }
  return invariantValidatorInstance;
}

/**
 * Reset the invariant validator (for testing)
 */
export function resetInvariantValidator(): void {
  invariantValidatorInstance = null;
}
