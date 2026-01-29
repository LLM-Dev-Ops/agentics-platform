/**
 * UI Hooks
 *
 * Implements ADR/DDD #006: UI Control Surface Architecture
 *
 * These hooks provide React state management for the control surface
 * workflow components.
 */

export { useIntent, type UseIntentReturn, type UseIntentState, type UseIntentActions } from './useIntent';

export {
  useConfirmationWorkflow,
  type UseConfirmationWorkflowReturn,
  type UseConfirmationWorkflowState,
  type UseConfirmationWorkflowActions,
} from './useConfirmationWorkflow';
