/**
 * Invariant Validator Service Tests
 *
 * Tests for ADR/DDD #005: System-Level Invariants
 *
 * Validates that all five system invariants can be checked:
 * - INV-C1: Decision Traceability
 * - INV-C2: Historical Context
 * - INV-C3: No Silent Correction
 * - INV-C4: Memory Authority
 * - INV-C5: Governance Not Bypassed
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InvariantValidator,
  resetInvariantValidator,
  getInvariantValidator,
  SYSTEM_INVARIANTS,
  type ValidationContext,
} from '../../../src/services/coherence/invariant-validator.js';
import { DecisionCategory, DecisionStatus, InvariantCategory } from '@agentics/shared';
import type { DecisionRecord, LineageRecord } from '@agentics/shared';

describe('InvariantValidator', () => {
  let validator: InvariantValidator;
  const context: ValidationContext = {
    correlationId: 'test-correlation',
    userId: 'test-user',
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    resetInvariantValidator();
    validator = getInvariantValidator();
    validator.clear();
  });

  describe('getInvariants', () => {
    it('should return all five system invariants', () => {
      const invariants = validator.getInvariants();

      expect(invariants).toHaveLength(5);
      expect(invariants.map(i => i.invariantId)).toEqual([
        'INV-C1',
        'INV-C2',
        'INV-C3',
        'INV-C4',
        'INV-C5',
      ]);
    });

    it('should have correct categories', () => {
      const invariants = validator.getInvariants();

      const c1 = invariants.find(i => i.invariantId === 'INV-C1');
      expect(c1?.category).toBe(InvariantCategory.TRACEABILITY);

      const c2 = invariants.find(i => i.invariantId === 'INV-C2');
      expect(c2?.category).toBe(InvariantCategory.HISTORICAL_CONTEXT);

      const c3 = invariants.find(i => i.invariantId === 'INV-C3');
      expect(c3?.category).toBe(InvariantCategory.DRIFT_HANDLING);

      const c4 = invariants.find(i => i.invariantId === 'INV-C4');
      expect(c4?.category).toBe(InvariantCategory.MEMORY_AUTHORITY);

      const c5 = invariants.find(i => i.invariantId === 'INV-C5');
      expect(c5?.category).toBe(InvariantCategory.GOVERNANCE);
    });
  });

  describe('INV-C1: Decision Traceability', () => {
    it('should validate complete decision record', () => {
      const decision: DecisionRecord = {
        decisionId: 'dec-1',
        category: DecisionCategory.POLICY_CHANGE,
        status: DecisionStatus.PENDING,
        subject: {
          subjectType: 'policy',
          subjectId: 'policy-1',
          description: 'Update policy',
          proposedAction: { action: 'update' },
        },
        initiatedBy: 'user-1',
        initiatedAt: new Date().toISOString(),
        context: {
          applicableRules: ['ADR-001'],
          relatedDecisions: [],
          relevantState: {},
        },
        historicalContext: {
          integrationStates: [],
          precedentDecisions: [],
          lineageChain: ['lineage-1'],
        },
        correlationId: 'corr-1',
        auditTrail: [
          {
            timestamp: new Date().toISOString(),
            action: 'created',
            userId: 'user-1',
            correlationId: 'corr-1',
          },
        ],
      };

      const result = validator.validateDecisionTraceability(decision, context);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect missing traceability fields', () => {
      const incompleteDecision = {
        decisionId: 'dec-1',
        category: DecisionCategory.POLICY_CHANGE,
        status: DecisionStatus.PENDING,
        subject: { subjectType: 'policy', subjectId: 'p-1', description: '', proposedAction: {} },
        // Missing: initiatedBy, initiatedAt, context, auditTrail
        historicalContext: { integrationStates: [], precedentDecisions: [], lineageChain: [] },
        correlationId: 'corr-1',
      } as DecisionRecord;

      const result = validator.validateDecisionTraceability(incompleteDecision, context);

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('INV-C2: Historical Context', () => {
    it('should validate decision with complete historical context', () => {
      const decision: DecisionRecord = {
        decisionId: 'dec-1',
        category: DecisionCategory.POLICY_CHANGE,
        status: DecisionStatus.PENDING,
        subject: { subjectType: 'policy', subjectId: 'p-1', description: '', proposedAction: {} },
        initiatedBy: 'user-1',
        initiatedAt: new Date().toISOString(),
        context: { applicableRules: [], relatedDecisions: [], relevantState: {} },
        historicalContext: {
          integrationStates: [
            { integrationId: 'int-1', name: 'Integration', stateHash: 'abc', capturedAt: new Date().toISOString() },
          ],
          precedentDecisions: [],
          lineageChain: ['lineage-1'],
        },
        correlationId: 'corr-1',
        auditTrail: [],
      };

      const result = validator.validateHistoricalContext(decision, context);

      expect(result.valid).toBe(true);
    });

    it('should detect missing historical context', () => {
      const decision = {
        decisionId: 'dec-1',
        category: DecisionCategory.POLICY_CHANGE,
        status: DecisionStatus.PENDING,
        subject: { subjectType: 'policy', subjectId: 'p-1', description: '', proposedAction: {} },
        initiatedBy: 'user-1',
        initiatedAt: new Date().toISOString(),
        context: { applicableRules: [], relatedDecisions: [], relevantState: {} },
        // Missing: historicalContext
        correlationId: 'corr-1',
        auditTrail: [],
      } as DecisionRecord;

      const result = validator.validateHistoricalContext(decision, context);

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.description.includes('historical context'))).toBe(true);
    });

    it('should require ERP Surface version for ERP contract evolution', () => {
      const decision: DecisionRecord = {
        decisionId: 'dec-1',
        category: DecisionCategory.ERP_CONTRACT_EVOLUTION,
        status: DecisionStatus.PENDING,
        subject: { subjectType: 'erp', subjectId: 'erp-1', description: '', proposedAction: {} },
        initiatedBy: 'user-1',
        initiatedAt: new Date().toISOString(),
        context: { applicableRules: [], relatedDecisions: [], relevantState: {} },
        historicalContext: {
          // Missing: erpSurfaceVersion
          integrationStates: [],
          precedentDecisions: [],
          lineageChain: [],
        },
        correlationId: 'corr-1',
        auditTrail: [],
      };

      const result = validator.validateHistoricalContext(decision, context);

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.description.includes('ERP Surface version'))).toBe(true);
    });
  });

  describe('INV-C3: No Silent Correction', () => {
    it('should pass when remediation is properly authorized', () => {
      const result = validator.validateNoSilentCorrection(
        'finding-1',
        true, // acknowledged
        true, // remediated
        'user-1', // authorizedBy
        context
      );

      expect(result.valid).toBe(true);
    });

    it('should fail when remediated without acknowledgment', () => {
      const result = validator.validateNoSilentCorrection(
        'finding-1',
        false, // NOT acknowledged
        true, // but remediated
        'user-1',
        context
      );

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.description.includes('without prior acknowledgment'))).toBe(true);
    });

    it('should fail when remediated without authorization', () => {
      const result = validator.validateNoSilentCorrection(
        'finding-1',
        true, // acknowledged
        true, // remediated
        undefined, // NO authorization
        context
      );

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.description.includes('lacks human authorization'))).toBe(true);
    });
  });

  describe('INV-C4: Memory Authority', () => {
    it('should pass when projection derives from memory', () => {
      const memory = { key1: 'value1', key2: 'value2' };
      const projection = { key1: 'value1' }; // Subset of memory

      const result = validator.validateMemoryAuthority(memory, projection, 'dashboard', context);

      expect(result.valid).toBe(true);
    });

    it('should fail when projection contains data not in memory', () => {
      const memory = { key1: 'value1' };
      const projection = { key1: 'value1', unauthorized: 'data' }; // Extra key

      const result = validator.validateMemoryAuthority(memory, projection, 'dashboard', context);

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.description.includes('unauthorized'))).toBe(true);
    });
  });

  describe('INV-C5: Governance Not Bypassed', () => {
    it('should pass when all required checks are performed', () => {
      const result = validator.validateGovernanceNotBypassed(
        'op-1',
        'deployment',
        ['auth_check', 'policy_check', 'approval_check'],
        ['auth_check', 'policy_check', 'approval_check'],
        context
      );

      expect(result.valid).toBe(true);
    });

    it('should fail when required check is missing', () => {
      const result = validator.validateGovernanceNotBypassed(
        'op-1',
        'deployment',
        ['auth_check', 'policy_check'], // Missing approval_check
        ['auth_check', 'policy_check', 'approval_check'],
        context
      );

      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.description.includes('approval_check'))).toBe(true);
    });
  });

  describe('validateLineageRecord', () => {
    it('should validate complete lineage record', () => {
      const lineage: LineageRecord = {
        lineageId: 'lineage-1',
        artifact: {
          artifactType: 'simulation' as any,
          artifactId: 'sim-1',
          version: '1.0',
          contentHash: 'abc',
        },
        derivedFrom: [],
        derivationOperation: {
          operationType: 'create',
          description: 'Created',
          parameters: {},
          deterministic: true,
        },
        governanceContext: {
          activeRules: ['rule-1'],
          adrVersion: '1.0.0',
          policiesEvaluated: [],
          complianceStatus: 'compliant',
        },
        derivedAt: new Date().toISOString(),
        authorizedBy: 'user-1',
        correlationId: 'corr-1',
      };

      const result = validator.validateLineageRecord(lineage, context);

      expect(result.valid).toBe(true);
    });

    it('should detect missing authorization', () => {
      const lineage = {
        lineageId: 'lineage-1',
        artifact: { artifactType: 'simulation', artifactId: 'sim-1', version: '1.0', contentHash: 'abc' },
        derivedFrom: [],
        derivationOperation: { operationType: 'create', description: '', parameters: {}, deterministic: true },
        governanceContext: { activeRules: [], adrVersion: '1.0.0', policiesEvaluated: [], complianceStatus: 'compliant' },
        derivedAt: new Date().toISOString(),
        // Missing: authorizedBy
        correlationId: 'corr-1',
      } as LineageRecord;

      const result = validator.validateLineageRecord(lineage, context);

      expect(result.valid).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track validation history and statistics', () => {
      const decision: DecisionRecord = {
        decisionId: 'dec-1',
        category: DecisionCategory.POLICY_CHANGE,
        status: DecisionStatus.PENDING,
        subject: { subjectType: 'policy', subjectId: 'p-1', description: '', proposedAction: {} },
        initiatedBy: 'user-1',
        initiatedAt: new Date().toISOString(),
        context: { applicableRules: [], relatedDecisions: [], relevantState: {} },
        historicalContext: { integrationStates: [], precedentDecisions: [], lineageChain: [] },
        correlationId: 'corr-1',
        auditTrail: [],
      };

      // Perform some validations
      validator.validateDecisionTraceability(decision, context);
      validator.validateHistoricalContext(decision, context);

      const stats = validator.getStatistics();

      expect(stats.totalValidations).toBeGreaterThan(0);
    });
  });
});
