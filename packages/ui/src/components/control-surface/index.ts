/**
 * Control Surface Components
 *
 * Implements ADR/DDD #006: UI Control Surface Architecture
 *
 * These components form the governed control surface that mirrors
 * claude-flow's Plan -> Review -> Commit -> Inspect workflow.
 *
 * UI INVARIANTS ENFORCED:
 * - INV-U1: Entry Point Equivalence (UI = CLI semantics)
 * - INV-U2: Governance Uniformity (same validation regardless of entry point)
 * - INV-U3: Intent Explicitness (no inference from ambiguous input)
 * - INV-U4: Commitment Confirmation (explicit confirmation for state changes)
 * - INV-U5: Governance Visibility (surface constraints visibly)
 * - INV-U6: Audit Completeness (full audit trail for UI actions)
 */

export { WorkflowPhaseIndicator } from './WorkflowPhaseIndicator';
export { GovernanceConstraintDisplay } from './GovernanceConstraintDisplay';
export { PreviewPanel } from './PreviewPanel';
export { ConfirmationWorkflow } from './ConfirmationWorkflow';
export { ExecutionResult } from './ExecutionResult';
