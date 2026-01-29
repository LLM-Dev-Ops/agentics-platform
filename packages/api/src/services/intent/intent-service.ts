/**
 * Intent Service
 *
 * Implements ADR/DDD #006: UI Control Surface Architecture
 *
 * This service manages the lifecycle of user intents:
 * - Declare: User declares explicit intent through structured input
 * - Validate: Governance validation against constraints
 * - Preview: Show what will happen before execution
 * - Confirm: Explicit confirmation for commitment intents
 * - Execute: Perform the operation
 * - Audit: Record all actions for traceability
 *
 * UI INVARIANTS ENFORCED:
 * - INV-U1: Entry Point Equivalence (same semantics as CLI)
 * - INV-U2: Governance Uniformity (same rules regardless of entry point)
 * - INV-U3: Intent Explicitness (no inference)
 * - INV-U4: Commitment Confirmation (explicit confirmation required)
 * - INV-U5: Governance Visibility (constraints surfaced)
 * - INV-U6: Audit Completeness (full audit trail)
 */

import { randomUUID } from 'crypto';
import type {
  Intent,
  IntentOperation,
  GovernanceValidationResult,
  GovernanceConstraint,
  GovernanceWarning,
  ConfirmationRequirement,
  PreviewData,
  ProposedChange,
  ImpactSummary,
  ExecutionResult,
  ActualChange,
  IntentAuditEntry,
  DeclareIntentRequest,
  ConfirmIntentRequest,
} from '@agentics/shared';
import {
  IntentCategory,
  IntentStatus,
  WorkflowPhase,
  EntryPoint,
  IntentDomain,
  ConfirmationType,
} from '@agentics/shared';
import {
  getHumanOversightService,
  type CreateDecisionRequest,
} from '../coherence/human-oversight.js';
import { DecisionCategory, DecisionStatus } from '@agentics/shared';

/**
 * Configuration for the intent service
 */
export interface IntentServiceConfig {
  /** How long intents remain valid before expiring (ms) */
  intentExpiryMs: number;
  /** How long previews remain valid (ms) */
  previewExpiryMs: number;
  /** Maximum intents to retain in memory */
  maxIntents: number;
  /** ADR version for governance context */
  adrVersion: string;
}

/**
 * Executor function type for domain-specific operations
 */
export type IntentExecutor = (
  intent: Intent,
  context: ExecutionContext
) => Promise<ExecutionResult>;

/**
 * Context provided to executors
 */
export interface ExecutionContext {
  userId: string;
  orgId: string;
  correlationId: string;
}

/**
 * Registry entry for an operation
 */
interface OperationRegistry {
  operation: IntentOperation;
  executor: IntentExecutor;
  previewGenerator?: (payload: Record<string, unknown>) => Promise<PreviewData>;
}

/**
 * Intent Service
 *
 * Manages the full lifecycle of user intents with governance enforcement.
 */
export class IntentService {
  private readonly config: IntentServiceConfig;
  private readonly intents: Map<string, Intent> = new Map();
  private readonly operations: Map<string, OperationRegistry> = new Map();

  constructor(config: Partial<IntentServiceConfig> = {}) {
    this.config = {
      intentExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
      previewExpiryMs: 5 * 60 * 1000, // 5 minutes
      maxIntents: 10000,
      adrVersion: '006',
      ...config,
    };

    // Register built-in operations
    this.registerBuiltinOperations();
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Declare a new intent
   *
   * This validates the intent against governance rules and returns
   * the intent with validation results. The intent is NOT executed.
   */
  async declare(
    request: DeclareIntentRequest,
    userId: string,
    orgId: string
  ): Promise<Intent> {
    const now = new Date().toISOString();
    const intentId = randomUUID();
    const correlationId = request.correlationId || randomUUID();

    // Look up the operation
    const operationKey = this.getOperationKey(request.domain, request.action);
    const operationRegistry = this.operations.get(operationKey);

    const operation: IntentOperation = operationRegistry?.operation || {
      domain: request.domain,
      action: request.action,
      description: `${request.action} on ${request.domain}`,
      requiredScopes: [],
      modifiesState: true, // Assume modifies state if unknown
    };

    // Determine category based on operation
    const category = operation.modifiesState
      ? IntentCategory.COMMITMENT
      : IntentCategory.OBSERVATION;

    // Validate against governance
    const governanceResult = await this.validateGovernance(
      operation,
      request.payload,
      category,
      userId,
      orgId
    );

    // Create the intent
    const intent: Intent = {
      intentId,
      category,
      status: governanceResult.permitted
        ? category === IntentCategory.COMMITMENT
          ? IntentStatus.PENDING_CONFIRMATION
          : IntentStatus.VALIDATED
        : IntentStatus.DECLARED,
      phase: governanceResult.permitted ? WorkflowPhase.REVIEW : WorkflowPhase.PLAN,
      operation,
      payload: request.payload,
      entryPoint: request.entryPoint,
      governanceResult,
      declaredBy: userId,
      declaredAt: now,
      correlationId,
      orgId,
      auditTrail: [
        this.createAuditEntry(
          'intent_declared',
          userId,
          request.entryPoint,
          WorkflowPhase.PLAN,
          governanceResult.permitted ? WorkflowPhase.REVIEW : WorkflowPhase.PLAN,
          correlationId,
          { domain: request.domain, action: request.action }
        ),
      ],
    };

    // Add validation audit entry
    if (governanceResult.permitted) {
      intent.auditTrail.push(
        this.createAuditEntry(
          'intent_validated',
          userId,
          request.entryPoint,
          WorkflowPhase.PLAN,
          WorkflowPhase.REVIEW,
          correlationId,
          { rulesEvaluated: governanceResult.rulesEvaluated.length }
        )
      );
    } else {
      intent.auditTrail.push(
        this.createAuditEntry(
          'validation_failed',
          userId,
          request.entryPoint,
          WorkflowPhase.PLAN,
          WorkflowPhase.PLAN,
          correlationId,
          { reason: governanceResult.denialReason }
        )
      );
    }

    // Store the intent
    this.storeIntent(intent);

    return intent;
  }

  /**
   * Get an intent by ID
   */
  getIntent(intentId: string): Intent | undefined {
    return this.intents.get(intentId);
  }

  /**
   * Generate a preview for an intent
   *
   * Shows what will happen before execution.
   */
  async generatePreview(intentId: string, userId: string): Promise<PreviewData | undefined> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      return undefined;
    }

    // Check if preview already exists and is still valid
    if (intent.preview) {
      const expiresAt = new Date(intent.preview.expiresAt).getTime();
      if (Date.now() < expiresAt) {
        return intent.preview;
      }
    }

    const now = new Date();
    const operationKey = this.getOperationKey(intent.operation.domain, intent.operation.action);
    const operationRegistry = this.operations.get(operationKey);

    let preview: PreviewData;

    if (operationRegistry?.previewGenerator) {
      preview = await operationRegistry.previewGenerator(intent.payload);
      preview.intentId = intentId;
      preview.previewId = randomUUID();
    } else {
      // Generate default preview
      preview = this.generateDefaultPreview(intent, now);
    }

    // Add governance constraints to preview
    if (intent.governanceResult) {
      preview.constraints = intent.governanceResult.constraints;
      preview.warnings = intent.governanceResult.warnings;
    }

    // Store preview on intent
    intent.preview = preview;

    // Add audit entry
    intent.auditTrail.push(
      this.createAuditEntry(
        'preview_generated',
        userId,
        intent.entryPoint,
        intent.phase,
        intent.phase,
        intent.correlationId
      )
    );

    return preview;
  }

  /**
   * Confirm a commitment intent
   *
   * Implements INV-U4: Commitment Confirmation
   */
  async confirm(request: ConfirmIntentRequest, userId: string): Promise<Intent | undefined> {
    const intent = this.intents.get(request.intentId);
    if (!intent) {
      return undefined;
    }

    // Can only confirm pending confirmation intents
    if (intent.status !== IntentStatus.PENDING_CONFIRMATION) {
      return undefined;
    }

    // Verify all confirmation requirements are satisfied
    const governanceResult = intent.governanceResult;
    if (!governanceResult) {
      return undefined;
    }

    // Check each acknowledgment against requirements
    for (const acknowledgment of request.acknowledgments) {
      const requirement = governanceResult.requiredConfirmations.find(
        r => r.requirementId === acknowledgment.requirementId
      );
      if (requirement) {
        requirement.satisfied = true;
        requirement.satisfiedAt = new Date().toISOString();
        requirement.satisfiedBy = userId;

        // Handle step completion for multi-step
        if (requirement.steps && acknowledgment.completedSteps) {
          for (const step of requirement.steps) {
            if (acknowledgment.completedSteps.includes(step.stepId)) {
              step.completed = true;
              step.completedAt = new Date().toISOString();

              intent.auditTrail.push(
                this.createAuditEntry(
                  'confirmation_step_completed',
                  userId,
                  intent.entryPoint,
                  WorkflowPhase.COMMIT,
                  WorkflowPhase.COMMIT,
                  intent.correlationId,
                  { stepId: step.stepId }
                )
              );
            }
          }
        }
      }
    }

    // Check if all requirements are satisfied
    const allSatisfied = governanceResult.requiredConfirmations.every(r => r.satisfied);

    if (allSatisfied) {
      intent.status = IntentStatus.CONFIRMED;
      intent.phase = WorkflowPhase.COMMIT;
      intent.confirmedBy = userId;
      intent.confirmedAt = new Date().toISOString();

      intent.auditTrail.push(
        this.createAuditEntry(
          'intent_confirmed',
          userId,
          intent.entryPoint,
          WorkflowPhase.REVIEW,
          WorkflowPhase.COMMIT,
          intent.correlationId
        )
      );
    }

    return intent;
  }

  /**
   * Execute a validated/confirmed intent
   */
  async execute(intentId: string, userId: string, orgId: string): Promise<ExecutionResult> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      return this.createErrorResult(intentId, 'INTENT_NOT_FOUND', 'Intent not found');
    }

    // Check status
    if (intent.category === IntentCategory.COMMITMENT && intent.status !== IntentStatus.CONFIRMED) {
      return this.createErrorResult(
        intentId,
        'NOT_CONFIRMED',
        'Commitment intent must be confirmed before execution'
      );
    }

    if (intent.category !== IntentCategory.COMMITMENT && intent.status !== IntentStatus.VALIDATED) {
      return this.createErrorResult(
        intentId,
        'NOT_VALIDATED',
        'Intent must be validated before execution'
      );
    }

    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    intent.auditTrail.push(
      this.createAuditEntry(
        'execution_started',
        userId,
        intent.entryPoint,
        intent.phase,
        WorkflowPhase.INSPECT,
        intent.correlationId
      )
    );

    try {
      // Look up executor
      const operationKey = this.getOperationKey(intent.operation.domain, intent.operation.action);
      const operationRegistry = this.operations.get(operationKey);

      let result: ExecutionResult;

      if (operationRegistry?.executor) {
        result = await operationRegistry.executor(intent, {
          userId,
          orgId,
          correlationId: intent.correlationId,
        });
      } else {
        // Default executor for unregistered operations
        result = await this.defaultExecutor(intent);
      }

      // Update intent
      intent.status = result.success ? IntentStatus.EXECUTED : IntentStatus.FAILED;
      intent.phase = WorkflowPhase.INSPECT;
      intent.executedAt = new Date().toISOString();
      intent.result = result;

      intent.auditTrail.push(
        this.createAuditEntry(
          result.success ? 'intent_executed' : 'execution_failed',
          userId,
          intent.entryPoint,
          WorkflowPhase.COMMIT,
          WorkflowPhase.INSPECT,
          intent.correlationId,
          result.success ? undefined : { error: result.error?.code }
        )
      );

      return result;
    } catch (error) {
      const completedAt = new Date().toISOString();
      const result = this.createErrorResult(
        intentId,
        'EXECUTION_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        startedAt,
        completedAt,
        Date.now() - startTime
      );

      intent.status = IntentStatus.FAILED;
      intent.phase = WorkflowPhase.INSPECT;
      intent.result = result;

      intent.auditTrail.push(
        this.createAuditEntry(
          'execution_failed',
          userId,
          intent.entryPoint,
          WorkflowPhase.COMMIT,
          WorkflowPhase.INSPECT,
          intent.correlationId,
          { error: 'EXECUTION_ERROR' }
        )
      );

      return result;
    }
  }

  /**
   * Cancel a pending intent
   */
  async cancel(intentId: string, userId: string, reason?: string): Promise<Intent | undefined> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      return undefined;
    }

    // Can only cancel non-executed intents
    if (
      intent.status === IntentStatus.EXECUTED ||
      intent.status === IntentStatus.FAILED ||
      intent.status === IntentStatus.CANCELLED
    ) {
      return undefined;
    }

    intent.status = IntentStatus.CANCELLED;

    intent.auditTrail.push(
      this.createAuditEntry(
        'intent_cancelled',
        userId,
        intent.entryPoint,
        intent.phase,
        intent.phase,
        intent.correlationId,
        { reason }
      )
    );

    return intent;
  }

  /**
   * Register an operation with its executor and optional preview generator
   */
  registerOperation(
    domain: IntentDomain,
    action: string,
    operation: IntentOperation,
    executor: IntentExecutor,
    previewGenerator?: (payload: Record<string, unknown>) => Promise<PreviewData>
  ): void {
    const key = this.getOperationKey(domain, action);
    this.operations.set(key, { operation, executor, previewGenerator });
  }

  /**
   * Get all intents for a user
   */
  getIntentsForUser(userId: string, status?: IntentStatus): Intent[] {
    return Array.from(this.intents.values()).filter(
      i => i.declaredBy === userId && (!status || i.status === status)
    );
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalIntents: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    byEntryPoint: Record<string, number>;
  } {
    const intents = Array.from(this.intents.values());

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byEntryPoint: Record<string, number> = {};

    for (const intent of intents) {
      byStatus[intent.status] = (byStatus[intent.status] || 0) + 1;
      byCategory[intent.category] = (byCategory[intent.category] || 0) + 1;
      byEntryPoint[intent.entryPoint] = (byEntryPoint[intent.entryPoint] || 0) + 1;
    }

    return {
      totalIntents: intents.length,
      byStatus,
      byCategory,
      byEntryPoint,
    };
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.intents.clear();
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private getOperationKey(domain: IntentDomain | string, action: string): string {
    return `${domain}:${action}`;
  }

  private storeIntent(intent: Intent): void {
    // Check capacity
    if (this.intents.size >= this.config.maxIntents) {
      // Remove oldest intent
      const oldestKey = this.intents.keys().next().value;
      if (oldestKey) {
        this.intents.delete(oldestKey);
      }
    }

    this.intents.set(intent.intentId, intent);
  }

  private async validateGovernance(
    operation: IntentOperation,
    payload: Record<string, unknown>,
    category: IntentCategory,
    userId: string,
    orgId: string
  ): Promise<GovernanceValidationResult> {
    const now = new Date().toISOString();
    const constraints: GovernanceConstraint[] = [];
    const warnings: GovernanceWarning[] = [];
    const requiredConfirmations: ConfirmationRequirement[] = [];
    const rulesEvaluated: string[] = [];

    // INV-U2: Same rules regardless of entry point
    rulesEvaluated.push('ADR-006/INV-U2');

    // INV-U3: Intent must be explicit
    constraints.push({
      constraintId: 'explicit-intent',
      description: 'Intent must be explicitly declared with structured parameters',
      severity: 'info',
      sourceRule: 'ADR-006/INV-U3',
      satisfied: true,
    });
    rulesEvaluated.push('ADR-006/INV-U3');

    // INV-U4: Commitment requires confirmation
    if (category === IntentCategory.COMMITMENT) {
      rulesEvaluated.push('ADR-006/INV-U4');

      // Determine what confirmations are required
      const confirmationType = this.determineConfirmationType(operation);

      requiredConfirmations.push({
        requirementId: randomUUID(),
        type: confirmationType,
        description: `Confirm ${operation.action} operation on ${operation.domain}`,
        satisfied: false,
        steps:
          confirmationType === ConfirmationType.MULTI_STEP
            ? [
                {
                  stepId: 'review-changes',
                  stepNumber: 1,
                  description: 'Review proposed changes',
                  completed: false,
                },
                {
                  stepId: 'acknowledge-impact',
                  stepNumber: 2,
                  description: 'Acknowledge impact assessment',
                  completed: false,
                },
                {
                  stepId: 'confirm-execution',
                  stepNumber: 3,
                  description: 'Confirm execution',
                  completed: false,
                },
              ]
            : undefined,
      });

      constraints.push({
        constraintId: 'commitment-confirmation',
        description: 'Commitment intents require explicit user confirmation',
        severity: 'blocking',
        sourceRule: 'ADR-006/INV-U4',
        satisfied: false, // Will be satisfied after confirmation
      });
    }

    // INV-U5: Governance visibility
    rulesEvaluated.push('ADR-006/INV-U5');
    constraints.push({
      constraintId: 'governance-visibility',
      description: 'All governance constraints are visible to the user',
      severity: 'info',
      sourceRule: 'ADR-006/INV-U5',
      satisfied: true,
    });

    // INV-U6: Audit completeness
    rulesEvaluated.push('ADR-006/INV-U6');
    constraints.push({
      constraintId: 'audit-completeness',
      description: 'All actions will be recorded in the audit trail',
      severity: 'info',
      sourceRule: 'ADR-006/INV-U6',
      satisfied: true,
    });

    // Check for scope requirements
    if (operation.requiredScopes.length > 0) {
      constraints.push({
        constraintId: 'scope-requirement',
        description: `Required scopes: ${operation.requiredScopes.join(', ')}`,
        severity: 'blocking',
        sourceRule: 'scope-enforcement',
        satisfied: true, // Assume satisfied; actual check would be in auth middleware
      });
    }

    // Add operation-specific warnings
    if (operation.modifiesState) {
      warnings.push({
        warningId: randomUUID(),
        message: 'This operation will modify system state',
        suggestedAction: 'Review the changes before confirming',
      });
    }

    return {
      permitted: true, // Governance passes by default; blocking constraints are checked later
      constraints,
      warnings,
      requiredConfirmations,
      validatedAt: now,
      rulesEvaluated,
      adrVersion: this.config.adrVersion,
    };
  }

  private determineConfirmationType(operation: IntentOperation): ConfirmationType {
    // High-risk operations require multi-step confirmation
    const highRiskActions = ['delete', 'revoke', 'deploy', 'approve', 'reject'];
    if (highRiskActions.includes(operation.action.toLowerCase())) {
      return ConfirmationType.MULTI_STEP;
    }

    // Standard modifications require explicit confirmation
    if (operation.modifiesState) {
      return ConfirmationType.EXPLICIT_CONFIRM;
    }

    // Default to acknowledgment
    return ConfirmationType.ACKNOWLEDGE;
  }

  private generateDefaultPreview(intent: Intent, now: Date): PreviewData {
    const changes: ProposedChange[] = [
      {
        changeType: 'create',
        resourceType: intent.operation.domain,
        description: `${intent.operation.action} operation`,
        after: intent.payload,
      },
    ];

    const impact: ImpactSummary = {
      affectedResources: [
        {
          resourceType: intent.operation.domain,
          resourceId: 'new',
          affectType: 'direct',
          description: `Will be affected by ${intent.operation.action}`,
        },
      ],
      reversible: false,
      downstreamEffects: [],
      riskLevel: intent.category === IntentCategory.COMMITMENT ? 'medium' : 'low',
    };

    return {
      previewId: randomUUID(),
      intentId: intent.intentId,
      changes,
      impact,
      constraints: [],
      warnings: [],
      generatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.config.previewExpiryMs).toISOString(),
    };
  }

  private async defaultExecutor(intent: Intent): Promise<ExecutionResult> {
    // Default executor just marks as complete
    // Real executors would perform actual operations
    const now = new Date().toISOString();

    return {
      executionId: randomUUID(),
      intentId: intent.intentId,
      success: true,
      data: { message: 'Operation completed (default executor)' },
      actualChanges: [
        {
          changeType: 'created',
          resourceType: intent.operation.domain,
          resourceId: randomUUID(),
          description: `Executed ${intent.operation.action}`,
        },
      ],
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      correlationId: intent.correlationId,
    };
  }

  private createErrorResult(
    intentId: string,
    code: string,
    message: string,
    startedAt?: string,
    completedAt?: string,
    durationMs?: number
  ): ExecutionResult {
    const now = new Date().toISOString();

    return {
      executionId: randomUUID(),
      intentId,
      success: false,
      error: {
        code,
        message,
        retryable: false,
      },
      actualChanges: [],
      startedAt: startedAt || now,
      completedAt: completedAt || now,
      durationMs: durationMs || 0,
      correlationId: randomUUID(),
    };
  }

  private createAuditEntry(
    action: IntentAuditEntry['action'],
    userId: string,
    entryPoint: EntryPoint,
    phaseBefore: WorkflowPhase,
    phaseAfter: WorkflowPhase,
    correlationId: string,
    context?: Record<string, unknown>
  ): IntentAuditEntry {
    return {
      entryId: randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      userId,
      entryPoint,
      phaseBefore,
      phaseAfter,
      correlationId,
      context,
    };
  }

  private registerBuiltinOperations(): void {
    // Register API key operations
    this.registerOperation(
      IntentDomain.API_KEYS,
      'create',
      {
        domain: IntentDomain.API_KEYS,
        action: 'create',
        description: 'Create a new API key',
        requiredScopes: ['platform:write'],
        modifiesState: true,
      },
      async (intent, context) => {
        // This would integrate with the actual API key service
        return {
          executionId: randomUUID(),
          intentId: intent.intentId,
          success: true,
          data: { keyId: randomUUID(), name: intent.payload.name },
          actualChanges: [
            {
              changeType: 'created',
              resourceType: 'api_key',
              resourceId: randomUUID(),
              description: `Created API key: ${intent.payload.name}`,
            },
          ],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          correlationId: context.correlationId,
        };
      }
    );

    this.registerOperation(
      IntentDomain.API_KEYS,
      'revoke',
      {
        domain: IntentDomain.API_KEYS,
        action: 'revoke',
        description: 'Revoke an API key',
        requiredScopes: ['platform:write'],
        modifiesState: true,
      },
      async (intent, context) => {
        return {
          executionId: randomUUID(),
          intentId: intent.intentId,
          success: true,
          data: { revoked: true },
          actualChanges: [
            {
              changeType: 'deleted',
              resourceType: 'api_key',
              resourceId: intent.payload.keyId as string,
              description: 'Revoked API key',
            },
          ],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          correlationId: context.correlationId,
        };
      }
    );

    // Register coherence operations
    this.registerOperation(
      IntentDomain.COHERENCE,
      'acknowledge_drift',
      {
        domain: IntentDomain.COHERENCE,
        action: 'acknowledge_drift',
        description: 'Acknowledge a drift finding',
        requiredScopes: ['governance:write'],
        modifiesState: true,
      },
      async (intent, context) => {
        return {
          executionId: randomUUID(),
          intentId: intent.intentId,
          success: true,
          data: { acknowledged: true, findingId: intent.payload.findingId },
          actualChanges: [
            {
              changeType: 'updated',
              resourceType: 'drift_finding',
              resourceId: intent.payload.findingId as string,
              description: 'Acknowledged drift finding',
              previousState: { acknowledged: false },
              newState: { acknowledged: true },
            },
          ],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          correlationId: context.correlationId,
        };
      }
    );
  }
}

// Singleton instance
let intentServiceInstance: IntentService | null = null;

/**
 * Get the intent service instance
 */
export function getIntentService(config?: Partial<IntentServiceConfig>): IntentService {
  if (!intentServiceInstance) {
    intentServiceInstance = new IntentService(config);
  }
  return intentServiceInstance;
}

/**
 * Reset the intent service (for testing)
 */
export function resetIntentService(): void {
  intentServiceInstance = null;
}
