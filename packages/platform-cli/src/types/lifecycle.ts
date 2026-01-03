/**
 * Intent lifecycle types
 */

/** Intent types supported by the platform */
export type IntentType =
  | 'deployment'
  | 'configuration'
  | 'scaling'
  | 'rollback'
  | 'migration';

/** Intent lifecycle states */
export type IntentState =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Intent definition */
export interface Intent {
  id: string;
  type: IntentType;
  target: string;
  state: IntentState;
  submittedBy: string;
  submittedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  metadata: Record<string, unknown>;
}

/** Intent submission request */
export interface IntentSubmission {
  type: IntentType;
  target: string;
  metadata?: Record<string, unknown>;
}

/** Promotion request between environments */
export interface PromotionRequest {
  sourceEnv: string;
  targetEnv: string;
  artifactIds?: string[];
  dryRun: boolean;
}
