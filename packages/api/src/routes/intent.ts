/**
 * Intent Routes
 *
 * Implements ADR/DDD #006: UI Control Surface Architecture
 *
 * Routes for the intent lifecycle:
 * - POST /v1/intent/declare - Declare an intent and validate against governance
 * - GET /v1/intent/:id - Get intent status and details
 * - GET /v1/intent/:id/preview - Get preview data for synthesis/commitment intents
 * - POST /v1/intent/:id/confirm - Confirm a commitment intent
 * - POST /v1/intent/:id/execute - Execute a confirmed/validated intent
 * - POST /v1/intent/:id/cancel - Cancel a pending intent
 * - GET /v1/intent - List intents for current user
 * - GET /v1/intent/statistics - Get intent service statistics
 *
 * UI INVARIANTS ENFORCED:
 * - INV-U1: Entry Point Equivalence (same semantics as CLI)
 * - INV-U2: Governance Uniformity (same validation regardless of entry point)
 * - INV-U3: Intent Explicitness (no inference from ambiguous input)
 * - INV-U4: Commitment Confirmation (explicit confirmation for state changes)
 * - INV-U5: Governance Visibility (surface constraints visibly)
 * - INV-U6: Audit Completeness (full audit trail for UI actions)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { getIntentService } from '../services/intent/index.js';
import {
  IntentDomain,
  IntentStatus,
  EntryPoint,
  type DeclareIntentRequest,
  type ConfirmIntentRequest,
} from '@agentics/shared';

// =============================================================================
// Request/Response Types
// =============================================================================

interface IntentParams {
  id: string;
}

interface DeclareIntentBody {
  domain: string;
  action: string;
  payload: Record<string, unknown>;
  entryPoint?: string;
  correlationId?: string;
}

interface ConfirmIntentBody {
  acknowledgments: Array<{
    requirementId: string;
    typedConfirmation?: string;
    completedSteps?: string[];
  }>;
}

interface CancelIntentBody {
  reason?: string;
}

interface ListIntentsQuerystring {
  status?: string;
}

// =============================================================================
// Handlers
// =============================================================================

/**
 * POST /v1/intent/declare
 * Declare a new intent and validate against governance
 *
 * This is the entry point for the control surface workflow.
 * The intent is validated but NOT executed.
 */
async function declareHandler(
  request: FastifyRequest<{ Body: DeclareIntentBody }>,
  reply: FastifyReply
): Promise<void> {
  const intentService = getIntentService();
  const correlationId = request.body.correlationId ||
    (request.headers['x-correlation-id'] as string) ||
    randomUUID();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';
  const orgId = (request.headers['x-org-id'] as string) || 'default';

  const { domain, action, payload, entryPoint } = request.body;

  // Validate domain
  if (!domain || !action) {
    return reply.status(400).send({
      error: 'Missing required fields: domain and action',
      code: 'INVALID_REQUEST',
    });
  }

  // Validate domain is known
  if (!Object.values(IntentDomain).includes(domain as IntentDomain)) {
    return reply.status(400).send({
      error: `Invalid domain: ${domain}`,
      code: 'INVALID_DOMAIN',
      validDomains: Object.values(IntentDomain),
    });
  }

  // Validate entry point
  const resolvedEntryPoint = entryPoint
    ? (Object.values(EntryPoint).includes(entryPoint as EntryPoint)
        ? (entryPoint as EntryPoint)
        : EntryPoint.API)
    : EntryPoint.API;

  const declareRequest: DeclareIntentRequest = {
    domain: domain as IntentDomain,
    action,
    payload: payload || {},
    entryPoint: resolvedEntryPoint,
    correlationId,
  };

  try {
    const intent = await intentService.declare(declareRequest, userId, orgId);

    // Return appropriate status based on governance result
    const statusCode = intent.governanceResult?.permitted ? 201 : 422;

    reply.status(statusCode).send({
      intent,
      message: intent.governanceResult?.permitted
        ? 'Intent declared and validated'
        : 'Intent declared but validation failed',
    });
  } catch (error) {
    reply.status(500).send({
      error: error instanceof Error ? error.message : 'Failed to declare intent',
      code: 'DECLARATION_ERROR',
    });
  }
}

/**
 * GET /v1/intent/:id
 * Get intent status and details
 */
async function getIntentHandler(
  request: FastifyRequest<{ Params: IntentParams }>,
  reply: FastifyReply
): Promise<void> {
  const intentService = getIntentService();
  const intent = intentService.getIntent(request.params.id);

  if (!intent) {
    return reply.status(404).send({
      error: 'Intent not found',
      code: 'NOT_FOUND',
    });
  }

  reply.status(200).send({ intent });
}

/**
 * GET /v1/intent/:id/preview
 * Get preview data showing what will happen
 *
 * Preview shows:
 * - Proposed changes
 * - Impact assessment
 * - Governance constraints
 * - Warnings
 */
async function previewHandler(
  request: FastifyRequest<{ Params: IntentParams }>,
  reply: FastifyReply
): Promise<void> {
  const intentService = getIntentService();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';

  const intent = intentService.getIntent(request.params.id);
  if (!intent) {
    return reply.status(404).send({
      error: 'Intent not found',
      code: 'NOT_FOUND',
    });
  }

  try {
    const preview = await intentService.generatePreview(request.params.id, userId);

    if (!preview) {
      return reply.status(404).send({
        error: 'Could not generate preview',
        code: 'PREVIEW_ERROR',
      });
    }

    reply.status(200).send({ preview });
  } catch (error) {
    reply.status(500).send({
      error: error instanceof Error ? error.message : 'Failed to generate preview',
      code: 'PREVIEW_ERROR',
    });
  }
}

/**
 * POST /v1/intent/:id/confirm
 * Confirm a commitment intent
 *
 * Implements INV-U4: Commitment Confirmation
 * This endpoint enforces explicit confirmation before execution.
 */
async function confirmHandler(
  request: FastifyRequest<{ Params: IntentParams; Body: ConfirmIntentBody }>,
  reply: FastifyReply
): Promise<void> {
  const intentService = getIntentService();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';

  const intent = intentService.getIntent(request.params.id);
  if (!intent) {
    return reply.status(404).send({
      error: 'Intent not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if intent is in confirmable state
  if (intent.status !== IntentStatus.PENDING_CONFIRMATION) {
    return reply.status(400).send({
      error: `Intent is not awaiting confirmation. Current status: ${intent.status}`,
      code: 'INVALID_STATE',
    });
  }

  const { acknowledgments } = request.body;

  if (!acknowledgments || !Array.isArray(acknowledgments)) {
    return reply.status(400).send({
      error: 'Missing required field: acknowledgments',
      code: 'INVALID_REQUEST',
    });
  }

  const confirmRequest: ConfirmIntentRequest = {
    intentId: request.params.id,
    acknowledgments,
  };

  try {
    const confirmedIntent = await intentService.confirm(confirmRequest, userId);

    if (!confirmedIntent) {
      return reply.status(400).send({
        error: 'Failed to confirm intent',
        code: 'CONFIRMATION_ERROR',
      });
    }

    const allConfirmed = confirmedIntent.status === IntentStatus.CONFIRMED;

    reply.status(200).send({
      intent: confirmedIntent,
      message: allConfirmed
        ? 'Intent confirmed. Ready for execution.'
        : 'Some confirmation requirements are still pending.',
      fullyConfirmed: allConfirmed,
    });
  } catch (error) {
    reply.status(500).send({
      error: error instanceof Error ? error.message : 'Failed to confirm intent',
      code: 'CONFIRMATION_ERROR',
    });
  }
}

/**
 * POST /v1/intent/:id/execute
 * Execute a confirmed/validated intent
 *
 * This is the final step that actually performs the operation.
 */
async function executeHandler(
  request: FastifyRequest<{ Params: IntentParams }>,
  reply: FastifyReply
): Promise<void> {
  const intentService = getIntentService();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';
  const orgId = (request.headers['x-org-id'] as string) || 'default';

  const intent = intentService.getIntent(request.params.id);
  if (!intent) {
    return reply.status(404).send({
      error: 'Intent not found',
      code: 'NOT_FOUND',
    });
  }

  try {
    const result = await intentService.execute(request.params.id, userId, orgId);

    const statusCode = result.success ? 200 : 500;

    reply.status(statusCode).send({
      result,
      intent: intentService.getIntent(request.params.id),
    });
  } catch (error) {
    reply.status(500).send({
      error: error instanceof Error ? error.message : 'Failed to execute intent',
      code: 'EXECUTION_ERROR',
    });
  }
}

/**
 * POST /v1/intent/:id/cancel
 * Cancel a pending intent
 *
 * Users can cancel intents that have not yet been executed.
 */
async function cancelHandler(
  request: FastifyRequest<{ Params: IntentParams; Body: CancelIntentBody }>,
  reply: FastifyReply
): Promise<void> {
  const intentService = getIntentService();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';

  const intent = intentService.getIntent(request.params.id);
  if (!intent) {
    return reply.status(404).send({
      error: 'Intent not found',
      code: 'NOT_FOUND',
    });
  }

  // Check if intent can be cancelled
  if (
    intent.status === IntentStatus.EXECUTED ||
    intent.status === IntentStatus.FAILED ||
    intent.status === IntentStatus.CANCELLED
  ) {
    return reply.status(400).send({
      error: `Cannot cancel intent with status: ${intent.status}`,
      code: 'INVALID_STATE',
    });
  }

  try {
    const cancelledIntent = await intentService.cancel(
      request.params.id,
      userId,
      request.body.reason
    );

    if (!cancelledIntent) {
      return reply.status(400).send({
        error: 'Failed to cancel intent',
        code: 'CANCELLATION_ERROR',
      });
    }

    reply.status(200).send({
      intent: cancelledIntent,
      message: 'Intent cancelled',
    });
  } catch (error) {
    reply.status(500).send({
      error: error instanceof Error ? error.message : 'Failed to cancel intent',
      code: 'CANCELLATION_ERROR',
    });
  }
}

/**
 * GET /v1/intent
 * List intents for the current user
 */
async function listIntentsHandler(
  request: FastifyRequest<{ Querystring: ListIntentsQuerystring }>,
  reply: FastifyReply
): Promise<void> {
  const intentService = getIntentService();
  const userId = (request.headers['x-user-id'] as string) || 'anonymous';

  const statusFilter = request.query.status
    ? (Object.values(IntentStatus).includes(request.query.status as IntentStatus)
        ? (request.query.status as IntentStatus)
        : undefined)
    : undefined;

  const intents = intentService.getIntentsForUser(userId, statusFilter);

  reply.status(200).send({
    intents,
    count: intents.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /v1/intent/statistics
 * Get intent service statistics
 */
async function statisticsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const intentService = getIntentService();
  const stats = intentService.getStatistics();

  reply.status(200).send({
    ...stats,
    timestamp: new Date().toISOString(),
  });
}

// =============================================================================
// Route Registration
// =============================================================================

/**
 * Register intent routes on a Fastify instance
 *
 * @param app - Fastify instance to register routes on
 */
export function registerIntentRoutes(app: FastifyInstance): void {
  // Intent lifecycle
  app.post('/v1/intent/declare', declareHandler);
  app.get('/v1/intent/statistics', statisticsHandler);
  app.get('/v1/intent', listIntentsHandler);
  app.get('/v1/intent/:id', getIntentHandler);
  app.get('/v1/intent/:id/preview', previewHandler);
  app.post('/v1/intent/:id/confirm', confirmHandler);
  app.post('/v1/intent/:id/execute', executeHandler);
  app.post('/v1/intent/:id/cancel', cancelHandler);
}
