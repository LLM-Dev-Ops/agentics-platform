/**
 * Human Oversight Service Tests
 *
 * Tests for ADR/DDD #005: Human Oversight Domain
 *
 * Validates that:
 * - Decisions are tracked but not auto-resolved
 * - Human authorization is required for resolution
 * - Alerts are surfaced but not auto-remediated
 * - Multi-party approval is respected for critical categories
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HumanOversightService,
  resetHumanOversightService,
  getHumanOversightService,
  type CreateDecisionRequest,
} from '../../../src/services/coherence/human-oversight.js';
import { DecisionCategory, DecisionStatus, DriftSeverity, AlertType } from '@agentics/shared';

describe('HumanOversightService', () => {
  let service: HumanOversightService;

  beforeEach(() => {
    resetHumanOversightService();
    service = getHumanOversightService();
    service.clear();
  });

  describe('createDecision', () => {
    it('should create a decision in pending status', () => {
      const request: CreateDecisionRequest = {
        category: DecisionCategory.POLICY_CHANGE,
        subject: {
          subjectType: 'policy',
          subjectId: 'policy-1',
          description: 'Update access policy',
          proposedAction: { action: 'modify', newValue: 'restricted' },
        },
        context: {
          applicableRules: ['ADR-001'],
          relatedDecisions: [],
          relevantState: {},
        },
        historicalContext: {
          integrationStates: [],
          precedentDecisions: [],
          lineageChain: [],
        },
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
      };

      const decision = service.createDecision(request);

      expect(decision.decisionId).toBeDefined();
      expect(decision.status).toBe(DecisionStatus.PENDING);
      expect(decision.initiatedBy).toBe('user-1');
      expect(decision.decidedBy).toBeUndefined();
      expect(decision.auditTrail).toHaveLength(1);
      expect(decision.auditTrail[0].action).toBe('decision_created');
    });

    it('should create an alert for pending decision', () => {
      const request: CreateDecisionRequest = {
        category: DecisionCategory.DEPLOYMENT_AUTHORIZATION,
        subject: {
          subjectType: 'deployment',
          subjectId: 'deploy-1',
          description: 'Deploy to production',
          proposedAction: { target: 'production' },
        },
        context: { applicableRules: [], relatedDecisions: [], relevantState: {} },
        historicalContext: { integrationStates: [], precedentDecisions: [], lineageChain: [] },
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
      };

      service.createDecision(request);

      const alerts = service.getUnacknowledgedAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].alertType).toBe(AlertType.DECISION_TIMEOUT);
    });
  });

  describe('resolveDecision', () => {
    it('should allow human to approve decision', () => {
      const createRequest: CreateDecisionRequest = {
        category: DecisionCategory.EXCEPTION_APPROVAL,
        subject: {
          subjectType: 'exception',
          subjectId: 'exc-1',
          description: 'Grant temporary exception',
          proposedAction: { grant: true },
        },
        context: { applicableRules: [], relatedDecisions: [], relevantState: {} },
        historicalContext: { integrationStates: [], precedentDecisions: [], lineageChain: [] },
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
      };

      const created = service.createDecision(createRequest);

      const resolved = service.resolveDecision({
        decisionId: created.decisionId,
        status: DecisionStatus.APPROVED,
        decidedBy: 'approver-1',
        rationale: 'Business justification provided',
        correlationId: 'corr-2',
      });

      expect(resolved).toBeDefined();
      expect(resolved!.status).toBe(DecisionStatus.APPROVED);
      expect(resolved!.decidedBy).toBe('approver-1');
      expect(resolved!.rationale).toBe('Business justification provided');
      expect(resolved!.auditTrail).toHaveLength(2);
    });

    it('should allow human to reject decision', () => {
      const createRequest: CreateDecisionRequest = {
        category: DecisionCategory.DRIFT_REMEDIATION,
        subject: {
          subjectType: 'remediation',
          subjectId: 'rem-1',
          description: 'Fix detected drift',
          proposedAction: { fix: 'revert' },
        },
        context: { applicableRules: [], relatedDecisions: [], relevantState: {} },
        historicalContext: { integrationStates: [], precedentDecisions: [], lineageChain: [] },
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
      };

      const created = service.createDecision(createRequest);

      const resolved = service.resolveDecision({
        decisionId: created.decisionId,
        status: DecisionStatus.REJECTED,
        decidedBy: 'reviewer-1',
        rationale: 'Drift is acceptable, no action needed',
        correlationId: 'corr-2',
      });

      expect(resolved).toBeDefined();
      expect(resolved!.status).toBe(DecisionStatus.REJECTED);
    });

    it('should not resolve non-existent decision', () => {
      const result = service.resolveDecision({
        decisionId: 'non-existent',
        status: DecisionStatus.APPROVED,
        decidedBy: 'user-1',
        rationale: 'test',
        correlationId: 'corr-1',
      });

      expect(result).toBeUndefined();
    });

    it('should not resolve already resolved decision', () => {
      const createRequest: CreateDecisionRequest = {
        category: DecisionCategory.POLICY_CHANGE,
        subject: {
          subjectType: 'policy',
          subjectId: 'policy-1',
          description: 'Change policy',
          proposedAction: {},
        },
        context: { applicableRules: [], relatedDecisions: [], relevantState: {} },
        historicalContext: { integrationStates: [], precedentDecisions: [], lineageChain: [] },
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
      };

      const created = service.createDecision(createRequest);

      // First resolution
      service.resolveDecision({
        decisionId: created.decisionId,
        status: DecisionStatus.APPROVED,
        decidedBy: 'user-2',
        rationale: 'First approval',
        correlationId: 'corr-2',
      });

      // Try to resolve again
      const secondAttempt = service.resolveDecision({
        decisionId: created.decisionId,
        status: DecisionStatus.REJECTED,
        decidedBy: 'user-3',
        rationale: 'Second attempt',
        correlationId: 'corr-3',
      });

      expect(secondAttempt).toBeUndefined();
    });
  });

  describe('getPendingDecisions', () => {
    it('should return only pending decisions', () => {
      const createRequest: CreateDecisionRequest = {
        category: DecisionCategory.POLICY_CHANGE,
        subject: {
          subjectType: 'policy',
          subjectId: 'policy-1',
          description: 'Policy change',
          proposedAction: {},
        },
        context: { applicableRules: [], relatedDecisions: [], relevantState: {} },
        historicalContext: { integrationStates: [], precedentDecisions: [], lineageChain: [] },
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
      };

      const decision1 = service.createDecision(createRequest);
      service.createDecision({ ...createRequest, correlationId: 'corr-2' });

      // Approve first decision
      service.resolveDecision({
        decisionId: decision1.decisionId,
        status: DecisionStatus.APPROVED,
        decidedBy: 'approver',
        rationale: 'Approved',
        correlationId: 'corr-3',
      });

      const pending = service.getPendingDecisions();

      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe(DecisionStatus.PENDING);
    });
  });

  describe('alerts', () => {
    it('should create and track alerts', () => {
      const alert = service.createAlert({
        alertType: AlertType.DRIFT_DETECTED,
        severity: DriftSeverity.WARNING,
        title: 'Drift Alert',
        message: 'Semantic drift detected in contract',
        source: {
          component: 'drift-detector',
          operation: 'detect',
          context: {},
        },
        correlationId: 'corr-1',
      });

      expect(alert.alertId).toBeDefined();
      expect(alert.acknowledged).toBe(false);

      const unacknowledged = service.getUnacknowledgedAlerts();
      expect(unacknowledged).toContainEqual(expect.objectContaining({ alertId: alert.alertId }));
    });

    it('should allow human to acknowledge alert', () => {
      const alert = service.createAlert({
        alertType: AlertType.INVARIANT_VIOLATION,
        severity: DriftSeverity.CRITICAL,
        title: 'Invariant Violation',
        message: 'INV-C3 violated',
        source: {
          component: 'invariant-validator',
          operation: 'validate',
          context: {},
        },
        correlationId: 'corr-1',
      });

      const acknowledged = service.acknowledgeAlert(alert.alertId, 'reviewer-1');

      expect(acknowledged).toBeDefined();
      expect(acknowledged!.acknowledged).toBe(true);
      expect(acknowledged!.acknowledgedBy).toBe('reviewer-1');
    });

    it('should surface drift findings as alerts', () => {
      const alert = service.surfaceDriftFinding(
        'finding-1',
        'Integration endpoint changed unexpectedly',
        DriftSeverity.WARNING,
        'corr-1'
      );

      expect(alert.alertType).toBe(AlertType.DRIFT_DETECTED);
      expect(alert.relatedFindings).toContain('finding-1');
      expect(alert.suggestedActions).toBeDefined();
      expect(alert.suggestedActions!.length).toBeGreaterThan(0);
    });
  });

  describe('multi-party approval', () => {
    it('should identify categories requiring multi-party approval', () => {
      expect(service.requiresMultiPartyApproval(DecisionCategory.POLICY_CHANGE)).toBe(true);
      expect(service.requiresMultiPartyApproval(DecisionCategory.GOVERNANCE_MODIFICATION)).toBe(true);
      expect(service.requiresMultiPartyApproval(DecisionCategory.DEPLOYMENT_AUTHORIZATION)).toBe(true);
      expect(service.requiresMultiPartyApproval(DecisionCategory.EXCEPTION_APPROVAL)).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', () => {
      const request: CreateDecisionRequest = {
        category: DecisionCategory.POLICY_CHANGE,
        subject: {
          subjectType: 'policy',
          subjectId: 'policy-1',
          description: 'Policy',
          proposedAction: {},
        },
        context: { applicableRules: [], relatedDecisions: [], relevantState: {} },
        historicalContext: { integrationStates: [], precedentDecisions: [], lineageChain: [] },
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
      };

      const decision = service.createDecision(request);
      service.createDecision({ ...request, correlationId: 'corr-2' });

      service.resolveDecision({
        decisionId: decision.decisionId,
        status: DecisionStatus.APPROVED,
        decidedBy: 'user-2',
        rationale: 'OK',
        correlationId: 'corr-3',
      });

      const stats = service.getStatistics();

      expect(stats.totalDecisions).toBe(2);
      expect(stats.pendingDecisions).toBe(1);
      expect(stats.approvedDecisions).toBe(1);
    });
  });
});
