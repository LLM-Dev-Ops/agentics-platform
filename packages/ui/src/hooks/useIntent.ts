'use client';

/**
 * useIntent Hook
 *
 * Implements ADR/DDD #006: UI Control Surface Architecture
 *
 * React hook for managing intent lifecycle in the control surface.
 * Handles the Plan -> Review -> Commit -> Inspect workflow.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  intentClient,
  type Intent,
  type PreviewData,
  type ExecutionResult,
  type DeclareIntentParams,
  type ConfirmationAcknowledgment,
  type WorkflowPhase,
  IntentApiError,
} from '@/lib/intent-client';

export interface UseIntentState {
  // Current intent being processed
  intent: Intent | null;

  // Preview data for review phase
  preview: PreviewData | null;

  // Execution result for inspect phase
  result: ExecutionResult | null;

  // Current workflow phase
  phase: WorkflowPhase;

  // Loading states
  isLoading: boolean;
  isDeclaring: boolean;
  isLoadingPreview: boolean;
  isConfirming: boolean;
  isExecuting: boolean;
  isCancelling: boolean;

  // Error state
  error: string | null;
}

export interface UseIntentActions {
  // Declare a new intent (Plan phase)
  declare: (params: DeclareIntentParams) => Promise<Intent | null>;

  // Load preview (Review phase)
  loadPreview: () => Promise<PreviewData | null>;

  // Confirm the intent (Commit phase)
  confirm: (acknowledgments: ConfirmationAcknowledgment[]) => Promise<boolean>;

  // Execute the intent
  execute: () => Promise<ExecutionResult | null>;

  // Cancel the intent
  cancel: (reason?: string) => Promise<boolean>;

  // Reset state
  reset: () => void;

  // Clear error
  clearError: () => void;
}

export interface UseIntentReturn extends UseIntentState, UseIntentActions {}

/**
 * Hook for managing intent lifecycle
 *
 * @param intentId - Optional initial intent ID to load
 * @returns Intent state and actions
 */
export function useIntent(intentId?: string): UseIntentReturn {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [phase, setPhase] = useState<WorkflowPhase>('plan');

  const [isDeclaring, setIsDeclaring] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const isLoading = isDeclaring || isLoadingPreview || isConfirming || isExecuting || isCancelling;

  // Load existing intent on mount if intentId provided
  useEffect(() => {
    if (intentId) {
      intentClient
        .get(intentId)
        .then(loadedIntent => {
          setIntent(loadedIntent);
          setPhase(loadedIntent.phase);
          if (loadedIntent.preview) {
            setPreview(loadedIntent.preview);
          }
          if (loadedIntent.result) {
            setResult(loadedIntent.result);
          }
        })
        .catch(err => {
          setError(err instanceof Error ? err.message : 'Failed to load intent');
        });
    }
  }, [intentId]);

  // Declare a new intent
  const declare = useCallback(async (params: DeclareIntentParams): Promise<Intent | null> => {
    setIsDeclaring(true);
    setError(null);

    try {
      const response = await intentClient.declare(params);
      setIntent(response.intent);
      setPhase(response.intent.phase);

      // If governance passed, move to review
      if (response.intent.governanceResult?.permitted) {
        setPhase('review');
      }

      return response.intent;
    } catch (err) {
      const message =
        err instanceof IntentApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to declare intent';
      setError(message);
      return null;
    } finally {
      setIsDeclaring(false);
    }
  }, []);

  // Load preview for review phase
  const loadPreview = useCallback(async (): Promise<PreviewData | null> => {
    if (!intent) {
      setError('No intent to preview');
      return null;
    }

    setIsLoadingPreview(true);
    setError(null);

    try {
      const previewData = await intentClient.preview(intent.intentId);
      setPreview(previewData);
      return previewData;
    } catch (err) {
      const message =
        err instanceof IntentApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load preview';
      setError(message);
      return null;
    } finally {
      setIsLoadingPreview(false);
    }
  }, [intent]);

  // Confirm the intent
  const confirm = useCallback(
    async (acknowledgments: ConfirmationAcknowledgment[]): Promise<boolean> => {
      if (!intent) {
        setError('No intent to confirm');
        return false;
      }

      setIsConfirming(true);
      setError(null);

      try {
        const response = await intentClient.confirm(intent.intentId, acknowledgments);
        setIntent(response.intent);

        if (response.fullyConfirmed) {
          setPhase('commit');
        }

        return response.fullyConfirmed;
      } catch (err) {
        const message =
          err instanceof IntentApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to confirm intent';
        setError(message);
        return false;
      } finally {
        setIsConfirming(false);
      }
    },
    [intent]
  );

  // Execute the intent
  const execute = useCallback(async (): Promise<ExecutionResult | null> => {
    if (!intent) {
      setError('No intent to execute');
      return null;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const response = await intentClient.execute(intent.intentId);
      setIntent(response.intent);
      setResult(response.result);
      setPhase('inspect');
      return response.result;
    } catch (err) {
      const message =
        err instanceof IntentApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to execute intent';
      setError(message);
      return null;
    } finally {
      setIsExecuting(false);
    }
  }, [intent]);

  // Cancel the intent
  const cancel = useCallback(
    async (reason?: string): Promise<boolean> => {
      if (!intent) {
        setError('No intent to cancel');
        return false;
      }

      setIsCancelling(true);
      setError(null);

      try {
        const response = await intentClient.cancel(intent.intentId, reason);
        setIntent(response.intent);
        return true;
      } catch (err) {
        const message =
          err instanceof IntentApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to cancel intent';
        setError(message);
        return false;
      } finally {
        setIsCancelling(false);
      }
    },
    [intent]
  );

  // Reset state
  const reset = useCallback(() => {
    setIntent(null);
    setPreview(null);
    setResult(null);
    setPhase('plan');
    setError(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    intent,
    preview,
    result,
    phase,
    isLoading,
    isDeclaring,
    isLoadingPreview,
    isConfirming,
    isExecuting,
    isCancelling,
    error,

    // Actions
    declare,
    loadPreview,
    confirm,
    execute,
    cancel,
    reset,
    clearError,
  };
}
