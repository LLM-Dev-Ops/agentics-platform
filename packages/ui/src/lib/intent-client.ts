/**
 * Intent Client for UI Control Surface
 *
 * Implements ADR/DDD #006: UI Control Surface Architecture
 *
 * This client provides the UI with access to the Intent API for:
 * - Declaring intents with explicit parameters
 * - Validating against governance
 * - Generating previews
 * - Confirming commitment intents
 * - Executing intents
 * - Cancelling pending intents
 *
 * UI INVARIANTS ENFORCED:
 * - INV-U1: Entry Point Equivalence (UI uses same API as CLI)
 * - INV-U2: Governance Uniformity (same validation as CLI)
 * - INV-U3: Intent Explicitness (structured input only)
 * - INV-U4: Commitment Confirmation (explicit confirmation required)
 * - INV-U5: Governance Visibility (constraints visible to user)
 * - INV-U6: Audit Completeness (full trail recorded)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get the current Supabase session access token
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const { getSupabase } = await import('./supabase');
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch (error) {
    console.error('[intent-client] Failed to get Supabase session:', error);
    return null;
  }
}

/**
 * API Error class for structured error handling
 */
export class IntentApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'IntentApiError';
  }
}

/**
 * Make an authenticated API request to the intent service
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('No active session');
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  if (!response.ok) {
    let errorData: { error?: string; code?: string; message?: string } = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: response.statusText };
    }

    throw new IntentApiError(
      response.status,
      errorData.code || 'API_ERROR',
      errorData.error || errorData.message || 'An error occurred'
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// =============================================================================
// Intent Types (mirroring @agentics/shared for UI use)
// =============================================================================

export type IntentCategory = 'observation' | 'synthesis' | 'commitment';

export type IntentStatus =
  | 'declared'
  | 'validated'
  | 'pending_confirmation'
  | 'confirmed'
  | 'executed'
  | 'failed'
  | 'cancelled';

export type WorkflowPhase = 'plan' | 'review' | 'commit' | 'inspect';

export type IntentDomain =
  | 'api_keys'
  | 'coherence'
  | 'simulation'
  | 'configuration'
  | 'deployment'
  | 'identity'
  | 'governance';

export interface IntentOperation {
  domain: IntentDomain;
  action: string;
  description: string;
  requiredScopes: string[];
  modifiesState: boolean;
}

export interface GovernanceConstraint {
  constraintId: string;
  description: string;
  severity: 'info' | 'warning' | 'blocking';
  sourceRule: string;
  satisfied: boolean;
}

export interface GovernanceWarning {
  warningId: string;
  message: string;
  constraintId?: string;
  suggestedAction?: string;
}

export interface ConfirmationRequirement {
  requirementId: string;
  type: 'acknowledge' | 'explicit_confirm' | 'multi_step' | 'type_to_confirm';
  description: string;
  steps?: ConfirmationStep[];
  satisfied: boolean;
  satisfiedAt?: string;
  satisfiedBy?: string;
}

export interface ConfirmationStep {
  stepId: string;
  stepNumber: number;
  description: string;
  completed: boolean;
  completedAt?: string;
}

export interface GovernanceValidationResult {
  permitted: boolean;
  constraints: GovernanceConstraint[];
  warnings: GovernanceWarning[];
  denialReason?: string;
  requiredConfirmations: ConfirmationRequirement[];
  validatedAt: string;
  rulesEvaluated: string[];
  adrVersion: string;
}

export interface ProposedChange {
  changeType: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId?: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changedFields?: string[];
}

export interface AffectedResource {
  resourceType: string;
  resourceId: string;
  affectType: 'direct' | 'indirect' | 'dependent';
  description: string;
}

export interface ImpactSummary {
  affectedResources: AffectedResource[];
  reversible: boolean;
  reversalMethod?: string;
  downstreamEffects: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface PreviewData {
  previewId: string;
  intentId: string;
  changes: ProposedChange[];
  impact: ImpactSummary;
  constraints: GovernanceConstraint[];
  warnings: GovernanceWarning[];
  generatedAt: string;
  expiresAt: string;
}

export interface ExecutionError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  suggestedAction?: string;
}

export interface ActualChange {
  changeType: 'created' | 'updated' | 'deleted';
  resourceType: string;
  resourceId: string;
  description: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
}

export interface ExecutionResult {
  executionId: string;
  intentId: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: ExecutionError;
  actualChanges: ActualChange[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  correlationId: string;
}

export interface IntentAuditEntry {
  entryId: string;
  timestamp: string;
  action: string;
  userId: string;
  entryPoint: string;
  phaseBefore: WorkflowPhase;
  phaseAfter: WorkflowPhase;
  correlationId: string;
  context?: Record<string, unknown>;
}

export interface Intent {
  intentId: string;
  category: IntentCategory;
  status: IntentStatus;
  phase: WorkflowPhase;
  operation: IntentOperation;
  payload: Record<string, unknown>;
  entryPoint: string;
  governanceResult?: GovernanceValidationResult;
  preview?: PreviewData;
  result?: ExecutionResult;
  declaredBy: string;
  declaredAt: string;
  confirmedBy?: string;
  confirmedAt?: string;
  executedAt?: string;
  correlationId: string;
  orgId: string;
  auditTrail: IntentAuditEntry[];
}

// =============================================================================
// Request Types
// =============================================================================

export interface DeclareIntentParams {
  domain: IntentDomain;
  action: string;
  payload: Record<string, unknown>;
}

export interface ConfirmationAcknowledgment {
  requirementId: string;
  typedConfirmation?: string;
  completedSteps?: string[];
}

// =============================================================================
// Response Types
// =============================================================================

interface DeclareResponse {
  intent: Intent;
  message: string;
}

interface GetIntentResponse {
  intent: Intent;
}

interface PreviewResponse {
  preview: PreviewData;
}

interface ConfirmResponse {
  intent: Intent;
  message: string;
  fullyConfirmed: boolean;
}

interface ExecuteResponse {
  result: ExecutionResult;
  intent: Intent;
}

interface CancelResponse {
  intent: Intent;
  message: string;
}

interface ListIntentsResponse {
  intents: Intent[];
  count: number;
  timestamp: string;
}

interface IntentStatistics {
  totalIntents: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byEntryPoint: Record<string, number>;
  timestamp: string;
}

// =============================================================================
// API Methods
// =============================================================================

/**
 * Declare a new intent
 *
 * This is the first step in the control surface workflow.
 * The intent is validated against governance but NOT executed.
 *
 * @param params - Domain, action, and payload for the intent
 * @returns The declared intent with governance validation results
 */
export async function declareIntent(params: DeclareIntentParams): Promise<DeclareResponse> {
  return request<DeclareResponse>('/v1/intent/declare', {
    method: 'POST',
    body: JSON.stringify({
      domain: params.domain,
      action: params.action,
      payload: params.payload,
      entryPoint: 'ui', // Always UI from this client
    }),
  });
}

/**
 * Get an intent by ID
 *
 * @param intentId - The intent ID
 * @returns The intent with current status
 */
export async function getIntent(intentId: string): Promise<Intent> {
  const response = await request<GetIntentResponse>(`/v1/intent/${intentId}`);
  return response.intent;
}

/**
 * Get preview data for an intent
 *
 * Shows what will happen before execution:
 * - Proposed changes
 * - Impact assessment
 * - Governance constraints
 * - Warnings
 *
 * @param intentId - The intent ID
 * @returns Preview data
 */
export async function getPreview(intentId: string): Promise<PreviewData> {
  const response = await request<PreviewResponse>(`/v1/intent/${intentId}/preview`);
  return response.preview;
}

/**
 * Confirm a commitment intent
 *
 * Implements INV-U4: Commitment Confirmation
 * Commitment intents require explicit confirmation before execution.
 *
 * @param intentId - The intent ID
 * @param acknowledgments - Acknowledgments of confirmation requirements
 * @returns The updated intent
 */
export async function confirmIntent(
  intentId: string,
  acknowledgments: ConfirmationAcknowledgment[]
): Promise<ConfirmResponse> {
  return request<ConfirmResponse>(`/v1/intent/${intentId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ acknowledgments }),
  });
}

/**
 * Execute an intent
 *
 * This is the final step that performs the operation.
 * The intent must be validated (observation/synthesis) or confirmed (commitment).
 *
 * @param intentId - The intent ID
 * @returns Execution result and updated intent
 */
export async function executeIntent(intentId: string): Promise<ExecuteResponse> {
  return request<ExecuteResponse>(`/v1/intent/${intentId}/execute`, {
    method: 'POST',
  });
}

/**
 * Cancel a pending intent
 *
 * Intents can be cancelled before execution.
 *
 * @param intentId - The intent ID
 * @param reason - Optional cancellation reason
 * @returns The cancelled intent
 */
export async function cancelIntent(intentId: string, reason?: string): Promise<CancelResponse> {
  return request<CancelResponse>(`/v1/intent/${intentId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * List intents for the current user
 *
 * @param status - Optional status filter
 * @returns List of intents
 */
export async function listIntents(status?: IntentStatus): Promise<ListIntentsResponse> {
  const queryParams = status ? `?status=${status}` : '';
  return request<ListIntentsResponse>(`/v1/intent${queryParams}`);
}

/**
 * Get intent service statistics
 *
 * @returns Aggregate statistics
 */
export async function getIntentStatistics(): Promise<IntentStatistics> {
  return request<IntentStatistics>('/v1/intent/statistics');
}

// =============================================================================
// Workflow Helpers
// =============================================================================

/**
 * Complete control surface workflow for a commitment intent
 *
 * This helper walks through the full workflow:
 * 1. Declare intent
 * 2. Get preview
 * 3. Confirm (with user-provided acknowledgments)
 * 4. Execute
 *
 * @param params - Intent parameters
 * @param onPreview - Callback with preview data (user should review)
 * @param getAcknowledgments - Callback to get user's acknowledgments
 * @returns Execution result
 */
export async function executeWorkflow(
  params: DeclareIntentParams,
  onPreview: (preview: PreviewData, intent: Intent) => Promise<boolean>,
  getAcknowledgments: (
    requirements: ConfirmationRequirement[]
  ) => Promise<ConfirmationAcknowledgment[] | null>
): Promise<ExecuteResponse | null> {
  // Step 1: Declare
  const declareResult = await declareIntent(params);
  const intent = declareResult.intent;

  // Check if governance allowed
  if (!intent.governanceResult?.permitted) {
    throw new IntentApiError(
      422,
      'GOVERNANCE_DENIED',
      intent.governanceResult?.denialReason || 'Intent not permitted by governance'
    );
  }

  // Step 2: Get preview
  const preview = await getPreview(intent.intentId);

  // Let user review preview
  const proceed = await onPreview(preview, intent);
  if (!proceed) {
    await cancelIntent(intent.intentId, 'User cancelled after preview');
    return null;
  }

  // Step 3: Confirm (for commitment intents)
  if (intent.category === 'commitment' && intent.governanceResult?.requiredConfirmations) {
    const acknowledgments = await getAcknowledgments(intent.governanceResult.requiredConfirmations);

    if (!acknowledgments) {
      await cancelIntent(intent.intentId, 'User cancelled during confirmation');
      return null;
    }

    const confirmResult = await confirmIntent(intent.intentId, acknowledgments);

    if (!confirmResult.fullyConfirmed) {
      throw new IntentApiError(
        400,
        'INCOMPLETE_CONFIRMATION',
        'Not all confirmation requirements were satisfied'
      );
    }
  }

  // Step 4: Execute
  return executeIntent(intent.intentId);
}

// =============================================================================
// Export for convenience
// =============================================================================

export const intentClient = {
  declare: declareIntent,
  get: getIntent,
  preview: getPreview,
  confirm: confirmIntent,
  execute: executeIntent,
  cancel: cancelIntent,
  list: listIntents,
  statistics: getIntentStatistics,
  executeWorkflow,
};
