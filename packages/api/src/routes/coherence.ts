/**
 * Coherence Routes
 *
 * Implements ADR/DDD #005: System Coherence, Drift Detection, and Self-Governance
 *
 * Routes for accessing coherence domain services:
 * - GET /v1/coherence/status - Quick coherence status
 * - GET /v1/coherence/assess - Full coherence assessment
 * - GET /v1/coherence/drift - List drift findings
 * - GET /v1/coherence/drift/:id - Get specific drift finding
 * - POST /v1/coherence/drift/:id/acknowledge - Acknowledge drift finding
 * - GET /v1/coherence/lineage/:artifactType/:artifactId - Get artifact lineage
 * - GET /v1/coherence/invariants - List system invariants
 * - GET /v1/coherence/decisions - List pending decisions
 * - POST /v1/coherence/decisions - Create decision request
 * - POST /v1/coherence/decisions/:id/resolve - Resolve decision
 * - GET /v1/coherence/alerts - List alerts
 * - POST /v1/coherence/alerts/:id/acknowledge - Acknowledge alert
 *
 * CRITICAL: These routes provide OBSERVATION only.
 * They do NOT trigger automatic remediation (INV-C3).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import {
  getCoherenceAssessor,
  type CreateDecisionRequest,
  type ResolveDecisionRequest,
} from '../services/coherence/index.js';
import { DecisionStatus, ArtifactType } from '@agentics/shared';

// =============================================================================
// Request/Response Types
// =============================================================================

interface AssessQuerystring {
  componentTypes?: string;
  includeIntegrations?: string;
  includeErpSurface?: string;
}

interface DriftFindingParams {
  id: string;
}

interface LineageParams {
  artifactType: string;
  artifactId: string;
}

interface DecisionParams {
  id: string;
}

interface AlertParams {
  id: string;
}

interface CreateDecisionBody {
  category: string;
  subject: {
    subjectType: string;
    subjectId: string;
    description: string;
    proposedAction: Record<string, unknown>;
  };
  context?: {
    applicableRules?: string[];
    relatedDecisions?: string[];
    relevantState?: Record<string, unknown>;
  };
  historicalContext?: {
    erpSurfaceVersion?: string;
    integrationStates?: Array<{
      integrationId: string;
      name: string;
      stateHash: string;
      capturedAt: string;
    }>;
    lineageChain?: string[];
  };
}

interface ResolveDecisionBody {
  status: 'approved' | 'rejected';
  rationale: string;
}

// =============================================================================
// Handlers
// =============================================================================

/**
 * GET /v1/coherence/status
 * Quick coherence status without full assessment
 */
async function statusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const status = assessor.getQuickStatus();

  reply.status(200).send({
    status: status.status,
    unacknowledgedDrift: status.unacknowledgedDrift,
    pendingDecisions: status.pendingDecisions,
    criticalAlerts: status.criticalAlerts,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /v1/coherence/assess
 * Perform full coherence assessment
 */
async function assessHandler(
  request: FastifyRequest<{ Querystring: AssessQuerystring }>,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const correlationId = (request.headers['x-correlation-id'] as string) || randomUUID();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';

  const scope = {
    componentTypes: request.query.componentTypes?.split(',') || ['all'],
    includeIntegrations: request.query.includeIntegrations === 'true',
    includeErpSurface: request.query.includeErpSurface === 'true',
  };

  const assessment = await assessor.assess(scope, userId, correlationId);

  reply.status(200).send(assessment);
}

/**
 * GET /v1/coherence/drift
 * List drift findings
 */
async function listDriftHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const findings = assessor.drift.getUnacknowledgedFindings();
  const stats = assessor.drift.getStatistics();

  reply.status(200).send({
    findings,
    statistics: stats,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /v1/coherence/drift/:id
 * Get specific drift finding
 */
async function getDriftHandler(
  request: FastifyRequest<{ Params: DriftFindingParams }>,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const finding = assessor.drift.getFinding(request.params.id);

  if (!finding) {
    return reply.status(404).send({
      error: 'Drift finding not found',
      code: 'NOT_FOUND',
    });
  }

  reply.status(200).send(finding);
}

/**
 * POST /v1/coherence/drift/:id/acknowledge
 * Acknowledge a drift finding (human action)
 *
 * IMPORTANT: Acknowledgment does NOT correct drift.
 * It only records that a human has reviewed the finding.
 */
async function acknowledgeDriftHandler(
  request: FastifyRequest<{ Params: DriftFindingParams }>,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';

  const finding = assessor.drift.acknowledgeFinding(request.params.id, userId);

  if (!finding) {
    return reply.status(404).send({
      error: 'Drift finding not found',
      code: 'NOT_FOUND',
    });
  }

  reply.status(200).send({
    message: 'Drift finding acknowledged',
    finding,
  });
}

/**
 * GET /v1/coherence/lineage/:artifactType/:artifactId
 * Get lineage chain for an artifact
 */
async function getLineageHandler(
  request: FastifyRequest<{ Params: LineageParams }>,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();

  // Validate artifact type
  const artifactType = request.params.artifactType as ArtifactType;
  if (!Object.values(ArtifactType).includes(artifactType)) {
    return reply.status(400).send({
      error: 'Invalid artifact type',
      code: 'INVALID_REQUEST',
      validTypes: Object.values(ArtifactType),
    });
  }

  const artifact = {
    artifactType,
    artifactId: request.params.artifactId,
    version: 'latest',
    contentHash: '',
  };

  const chain = assessor.lineage.getLineageChain(artifact);
  const integrity = assessor.lineage.verifyLineageIntegrity(artifact);

  reply.status(200).send({
    artifact,
    chain,
    integrity,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /v1/coherence/invariants
 * List system invariants and their status
 */
async function listInvariantsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const invariants = assessor.getInvariantStatus();
  const stats = assessor.invariants.getStatistics();

  reply.status(200).send({
    invariants,
    statistics: stats,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /v1/coherence/decisions
 * List pending decisions requiring human authorization
 */
async function listDecisionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const pending = assessor.oversight.getPendingDecisions();
  const stats = assessor.oversight.getStatistics();

  reply.status(200).send({
    pending,
    statistics: stats,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /v1/coherence/decisions
 * Create a new decision request requiring human authorization
 */
async function createDecisionHandler(
  request: FastifyRequest<{ Body: CreateDecisionBody }>,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const correlationId = (request.headers['x-correlation-id'] as string) || randomUUID();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';

  const { category, subject, context, historicalContext } = request.body;

  if (!category || !subject) {
    return reply.status(400).send({
      error: 'Missing required fields: category and subject',
      code: 'INVALID_REQUEST',
    });
  }

  const decisionRequest: CreateDecisionRequest = {
    category: category as any,
    subject: {
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      description: subject.description,
      proposedAction: subject.proposedAction,
    },
    context: {
      applicableRules: context?.applicableRules || [],
      relatedDecisions: context?.relatedDecisions || [],
      relevantState: context?.relevantState || {},
    },
    historicalContext: {
      erpSurfaceVersion: historicalContext?.erpSurfaceVersion,
      integrationStates: historicalContext?.integrationStates || [],
      precedentDecisions: [],
      lineageChain: historicalContext?.lineageChain || [],
    },
    initiatedBy: userId,
    correlationId,
  };

  const decision = assessor.oversight.createDecision(decisionRequest);

  reply.status(201).send({
    message: 'Decision request created',
    decision,
  });
}

/**
 * POST /v1/coherence/decisions/:id/resolve
 * Resolve a pending decision (approve or reject)
 *
 * This records the human decision. Execution of the approved action
 * is the responsibility of the caller.
 */
async function resolveDecisionHandler(
  request: FastifyRequest<{ Params: DecisionParams; Body: ResolveDecisionBody }>,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const correlationId = (request.headers['x-correlation-id'] as string) || randomUUID();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';

  const { status, rationale } = request.body;

  if (!status || !rationale) {
    return reply.status(400).send({
      error: 'Missing required fields: status and rationale',
      code: 'INVALID_REQUEST',
    });
  }

  if (status !== 'approved' && status !== 'rejected') {
    return reply.status(400).send({
      error: 'Invalid status. Must be "approved" or "rejected"',
      code: 'INVALID_REQUEST',
    });
  }

  const resolveRequest: ResolveDecisionRequest = {
    decisionId: request.params.id,
    status: status === 'approved' ? DecisionStatus.APPROVED : DecisionStatus.REJECTED,
    decidedBy: userId,
    rationale,
    correlationId,
  };

  const decision = assessor.oversight.resolveDecision(resolveRequest);

  if (!decision) {
    return reply.status(404).send({
      error: 'Decision not found or not in pending status',
      code: 'NOT_FOUND',
    });
  }

  reply.status(200).send({
    message: `Decision ${status}`,
    decision,
  });
}

/**
 * GET /v1/coherence/alerts
 * List coherence alerts
 */
async function listAlertsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const unacknowledged = assessor.oversight.getUnacknowledgedAlerts();
  const all = assessor.oversight.getAllAlerts();

  reply.status(200).send({
    unacknowledged,
    all,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /v1/coherence/alerts/:id/acknowledge
 * Acknowledge an alert
 */
async function acknowledgeAlertHandler(
  request: FastifyRequest<{ Params: AlertParams }>,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';

  const alert = assessor.oversight.acknowledgeAlert(request.params.id, userId);

  if (!alert) {
    return reply.status(404).send({
      error: 'Alert not found',
      code: 'NOT_FOUND',
    });
  }

  reply.status(200).send({
    message: 'Alert acknowledged',
    alert,
  });
}

/**
 * GET /v1/coherence/statistics
 * Get aggregate statistics across all coherence services
 */
async function statisticsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const assessor = getCoherenceAssessor();
  const stats = assessor.getStatistics();

  reply.status(200).send({
    ...stats,
    timestamp: new Date().toISOString(),
  });
}

// =============================================================================
// Route Registration
// =============================================================================

/**
 * Register coherence routes on a Fastify instance
 *
 * @param app - Fastify instance to register routes on
 */
export function registerCoherenceRoutes(app: FastifyInstance): void {
  // Status and Assessment
  app.get('/v1/coherence/status', statusHandler);
  app.get('/v1/coherence/assess', assessHandler);
  app.get('/v1/coherence/statistics', statisticsHandler);

  // Drift Detection
  app.get('/v1/coherence/drift', listDriftHandler);
  app.get('/v1/coherence/drift/:id', getDriftHandler);
  app.post('/v1/coherence/drift/:id/acknowledge', acknowledgeDriftHandler);

  // Lineage Tracking
  app.get('/v1/coherence/lineage/:artifactType/:artifactId', getLineageHandler);

  // Invariant Validation
  app.get('/v1/coherence/invariants', listInvariantsHandler);

  // Human Oversight - Decisions
  app.get('/v1/coherence/decisions', listDecisionsHandler);
  app.post('/v1/coherence/decisions', createDecisionHandler);
  app.post('/v1/coherence/decisions/:id/resolve', resolveDecisionHandler);

  // Human Oversight - Alerts
  app.get('/v1/coherence/alerts', listAlertsHandler);
  app.post('/v1/coherence/alerts/:id/acknowledge', acknowledgeAlertHandler);
}
