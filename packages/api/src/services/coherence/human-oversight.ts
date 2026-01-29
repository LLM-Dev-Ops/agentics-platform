/**
 * Human Oversight Boundary Service
 *
 * Implements ADR/DDD #005: Human Oversight Domain
 *
 * This service enforces the boundary between system capability and human authority.
 * It ensures that decisions requiring human judgment are never bypassed.
 *
 * Key Principles:
 * - Enterprise policy changes require human judgment
 * - Governance rule modifications require human approval
 * - Production deployment requires human authorization
 * - Exception approval requires human review
 * - Drift remediation requires human decision
 * - ERP contract evolution requires human oversight
 *
 * This service TRACKS and SURFACES decisions; it does NOT make them.
 */

import { randomUUID } from 'crypto';
import type {
  DecisionRecord,
  DecisionSubject,
  DecisionContext,
  HistoricalContext,
  DecisionAuditEntry,
  CoherenceAlert,
  AlertSource,
  ImpactAssessment,
} from '@agentics/shared';
import {
  DecisionCategory,
  DecisionStatus,
  AlertType,
  DriftSeverity,
} from '@agentics/shared';

/**
 * Configuration for human oversight
 */
export interface HumanOversightConfig {
  /** Timeout for pending decisions (ms) */
  decisionTimeoutMs: number;
  /** Maximum alerts to retain */
  maxAlerts: number;
  /** Categories that require multi-party approval */
  multiPartyCategories: DecisionCategory[];
}

/**
 * Request to create a new decision
 */
export interface CreateDecisionRequest {
  category: DecisionCategory;
  subject: DecisionSubject;
  context: DecisionContext;
  historicalContext: HistoricalContext;
  initiatedBy: string;
  correlationId: string;
}

/**
 * Request to resolve a decision
 */
export interface ResolveDecisionRequest {
  decisionId: string;
  status: DecisionStatus.APPROVED | DecisionStatus.REJECTED;
  decidedBy: string;
  rationale: string;
  correlationId: string;
}

/**
 * Human Oversight Boundary Service
 *
 * Manages the lifecycle of decisions requiring human authorization.
 */
export class HumanOversightService {
  private readonly config: HumanOversightConfig;
  private readonly decisions: Map<string, DecisionRecord> = new Map();
  private readonly alerts: Map<string, CoherenceAlert> = new Map();
  private readonly decisionsByCategory: Map<DecisionCategory, string[]> = new Map();

  constructor(config: Partial<HumanOversightConfig> = {}) {
    this.config = {
      decisionTimeoutMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxAlerts: 1000,
      multiPartyCategories: [
        DecisionCategory.POLICY_CHANGE,
        DecisionCategory.GOVERNANCE_MODIFICATION,
        DecisionCategory.DEPLOYMENT_AUTHORIZATION,
      ],
      ...config,
    };
  }

  /**
   * Create a new decision requiring human authorization
   *
   * This does NOT approve the decision - it creates a pending request
   * that must be reviewed by a human.
   */
  createDecision(request: CreateDecisionRequest): DecisionRecord {
    const decisionId = randomUUID();
    const now = new Date().toISOString();

    const decision: DecisionRecord = {
      decisionId,
      category: request.category,
      status: DecisionStatus.PENDING,
      subject: request.subject,
      initiatedBy: request.initiatedBy,
      initiatedAt: now,
      context: request.context,
      historicalContext: request.historicalContext,
      correlationId: request.correlationId,
      auditTrail: [
        {
          timestamp: now,
          action: 'decision_created',
          userId: request.initiatedBy,
          details: { category: request.category },
          correlationId: request.correlationId,
        },
      ],
    };

    // Store the decision
    this.decisions.set(decisionId, decision);

    // Index by category
    const categoryDecisions = this.decisionsByCategory.get(request.category) || [];
    categoryDecisions.push(decisionId);
    this.decisionsByCategory.set(request.category, categoryDecisions);

    // Create an alert for pending decision
    this.createAlert({
      alertType: AlertType.DECISION_TIMEOUT,
      severity: this.getSeverityForCategory(request.category),
      title: `Decision Required: ${request.category}`,
      message: `A ${request.category} decision requires human authorization`,
      source: {
        component: 'human-oversight',
        operation: 'decision_created',
        context: { decisionId, category: request.category },
      },
      correlationId: request.correlationId,
    });

    return decision;
  }

  /**
   * Resolve a pending decision (approve or reject)
   *
   * This records the human decision but does NOT execute any action.
   * Execution is the responsibility of the caller based on the decision outcome.
   */
  resolveDecision(request: ResolveDecisionRequest): DecisionRecord | undefined {
    const decision = this.decisions.get(request.decisionId);
    if (!decision) {
      return undefined;
    }

    if (decision.status !== DecisionStatus.PENDING) {
      // Cannot resolve a non-pending decision
      return undefined;
    }

    const now = new Date().toISOString();

    // Update decision status
    decision.status = request.status;
    decision.decidedBy = request.decidedBy;
    decision.decidedAt = now;
    decision.rationale = request.rationale;

    // Add audit entry
    decision.auditTrail.push({
      timestamp: now,
      action: request.status === DecisionStatus.APPROVED ? 'decision_approved' : 'decision_rejected',
      userId: request.decidedBy,
      details: { rationale: request.rationale },
      correlationId: request.correlationId,
    });

    return decision;
  }

  /**
   * Get a decision by ID
   */
  getDecision(decisionId: string): DecisionRecord | undefined {
    return this.decisions.get(decisionId);
  }

  /**
   * Get all pending decisions
   */
  getPendingDecisions(): DecisionRecord[] {
    return Array.from(this.decisions.values()).filter(
      d => d.status === DecisionStatus.PENDING
    );
  }

  /**
   * Get pending decisions by category
   */
  getPendingByCategory(category: DecisionCategory): DecisionRecord[] {
    const decisionIds = this.decisionsByCategory.get(category) || [];
    return decisionIds
      .map(id => this.decisions.get(id))
      .filter((d): d is DecisionRecord => d !== undefined && d.status === DecisionStatus.PENDING);
  }

  /**
   * Check for expired decisions and mark them
   */
  checkExpiredDecisions(): DecisionRecord[] {
    const now = Date.now();
    const expired: DecisionRecord[] = [];

    for (const decision of this.decisions.values()) {
      if (decision.status !== DecisionStatus.PENDING) {
        continue;
      }

      const initiatedAt = new Date(decision.initiatedAt).getTime();
      if (now - initiatedAt > this.config.decisionTimeoutMs) {
        decision.status = DecisionStatus.EXPIRED;
        decision.auditTrail.push({
          timestamp: new Date().toISOString(),
          action: 'decision_expired',
          userId: 'system',
          details: { reason: 'Timeout exceeded' },
          correlationId: decision.correlationId,
        });
        expired.push(decision);

        // Create alert for expired decision
        this.createAlert({
          alertType: AlertType.DECISION_TIMEOUT,
          severity: DriftSeverity.CRITICAL,
          title: `Decision Expired: ${decision.category}`,
          message: `Decision ${decision.decisionId} expired without resolution`,
          source: {
            component: 'human-oversight',
            operation: 'decision_expired',
            context: { decisionId: decision.decisionId },
          },
          correlationId: decision.correlationId,
        });
      }
    }

    return expired;
  }

  /**
   * Supersede a decision with a newer one
   */
  supersedeDecision(
    oldDecisionId: string,
    newDecision: CreateDecisionRequest
  ): { old: DecisionRecord | undefined; new: DecisionRecord } {
    const oldDecision = this.decisions.get(oldDecisionId);
    if (oldDecision && oldDecision.status === DecisionStatus.PENDING) {
      oldDecision.status = DecisionStatus.SUPERSEDED;
      oldDecision.auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'decision_superseded',
        userId: newDecision.initiatedBy,
        details: { supersededBy: 'new decision' },
        correlationId: newDecision.correlationId,
      });
    }

    const newDecisionRecord = this.createDecision(newDecision);

    return { old: oldDecision, new: newDecisionRecord };
  }

  /**
   * Check if a decision category requires multi-party approval
   */
  requiresMultiPartyApproval(category: DecisionCategory): boolean {
    return this.config.multiPartyCategories.includes(category);
  }

  /**
   * Create a coherence alert
   */
  createAlert(params: {
    alertType: AlertType;
    severity: DriftSeverity;
    title: string;
    message: string;
    source: AlertSource;
    correlationId: string;
    relatedFindings?: string[];
    suggestedActions?: string[];
  }): CoherenceAlert {
    const alert: CoherenceAlert = {
      alertId: randomUUID(),
      alertType: params.alertType,
      severity: params.severity,
      title: params.title,
      message: params.message,
      source: params.source,
      raisedAt: new Date().toISOString(),
      acknowledged: false,
      relatedFindings: params.relatedFindings,
      suggestedActions: params.suggestedActions,
      correlationId: params.correlationId,
    };

    // Store alert
    this.alerts.set(alert.alertId, alert);

    // Trim old alerts if over limit
    if (this.alerts.size > this.config.maxAlerts) {
      const oldestKey = this.alerts.keys().next().value;
      if (oldestKey) {
        this.alerts.delete(oldestKey);
      }
    }

    return alert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, userId: string): CoherenceAlert | undefined {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return undefined;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date().toISOString();

    return alert;
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): CoherenceAlert[] {
    return Array.from(this.alerts.values()).filter(a => !a.acknowledged);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: DriftSeverity): CoherenceAlert[] {
    return Array.from(this.alerts.values()).filter(a => a.severity === severity);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): CoherenceAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Surface a drift finding for human review
   *
   * Creates an alert that informs operators about drift without taking action.
   */
  surfaceDriftFinding(
    findingId: string,
    description: string,
    severity: DriftSeverity,
    correlationId: string
  ): CoherenceAlert {
    return this.createAlert({
      alertType: AlertType.DRIFT_DETECTED,
      severity,
      title: 'Drift Detected',
      message: description,
      source: {
        component: 'drift-detector',
        operation: 'drift_surfaced',
        context: { findingId },
      },
      relatedFindings: [findingId],
      suggestedActions: [
        'Review the drift finding details',
        'Assess business impact',
        'Determine if remediation is required',
        'If remediation needed, create a decision request',
      ],
      correlationId,
    });
  }

  /**
   * Get statistics about human oversight
   */
  getStatistics(): {
    totalDecisions: number;
    pendingDecisions: number;
    approvedDecisions: number;
    rejectedDecisions: number;
    expiredDecisions: number;
    totalAlerts: number;
    unacknowledgedAlerts: number;
    decisionsByCategory: Record<string, number>;
  } {
    const decisions = Array.from(this.decisions.values());
    const alerts = Array.from(this.alerts.values());

    const decisionsByCategory: Record<string, number> = {};
    for (const [category, ids] of this.decisionsByCategory.entries()) {
      decisionsByCategory[category] = ids.length;
    }

    return {
      totalDecisions: decisions.length,
      pendingDecisions: decisions.filter(d => d.status === DecisionStatus.PENDING).length,
      approvedDecisions: decisions.filter(d => d.status === DecisionStatus.APPROVED).length,
      rejectedDecisions: decisions.filter(d => d.status === DecisionStatus.REJECTED).length,
      expiredDecisions: decisions.filter(d => d.status === DecisionStatus.EXPIRED).length,
      totalAlerts: alerts.length,
      unacknowledgedAlerts: alerts.filter(a => !a.acknowledged).length,
      decisionsByCategory,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Get severity level for a decision category
   */
  private getSeverityForCategory(category: DecisionCategory): DriftSeverity {
    switch (category) {
      case DecisionCategory.POLICY_CHANGE:
      case DecisionCategory.GOVERNANCE_MODIFICATION:
      case DecisionCategory.DEPLOYMENT_AUTHORIZATION:
        return DriftSeverity.CRITICAL;
      case DecisionCategory.EXCEPTION_APPROVAL:
      case DecisionCategory.DRIFT_REMEDIATION:
        return DriftSeverity.WARNING;
      case DecisionCategory.ERP_CONTRACT_EVOLUTION:
        return DriftSeverity.WARNING;
      default:
        return DriftSeverity.INFO;
    }
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.decisions.clear();
    this.alerts.clear();
    this.decisionsByCategory.clear();
  }
}

// Singleton instance
let humanOversightInstance: HumanOversightService | null = null;

/**
 * Get the human oversight service instance
 */
export function getHumanOversightService(
  config?: Partial<HumanOversightConfig>
): HumanOversightService {
  if (!humanOversightInstance) {
    humanOversightInstance = new HumanOversightService(config);
  }
  return humanOversightInstance;
}

/**
 * Reset the human oversight service (for testing)
 */
export function resetHumanOversightService(): void {
  humanOversightInstance = null;
}
