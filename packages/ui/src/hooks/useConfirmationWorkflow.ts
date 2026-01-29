'use client';

/**
 * useConfirmationWorkflow Hook
 *
 * Implements ADR/DDD #006: INV-U4 Commitment Confirmation
 *
 * Manages the state of confirmation requirements for commitment intents.
 * Tracks which requirements are satisfied and provides helpers for
 * building acknowledgments.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  type ConfirmationRequirement,
  type ConfirmationAcknowledgment,
} from '@/lib/intent-client';

export interface UseConfirmationWorkflowState {
  // Which requirements have been acknowledged
  acknowledged: Set<string>;

  // Typed confirmations by requirement ID
  typedConfirmations: Map<string, string>;

  // Completed steps by requirement ID
  completedSteps: Map<string, string[]>;

  // Whether all requirements are satisfied
  allSatisfied: boolean;

  // Current acknowledgments ready to submit
  acknowledgments: ConfirmationAcknowledgment[];
}

export interface UseConfirmationWorkflowActions {
  // Acknowledge a requirement
  acknowledge: (requirementId: string) => void;

  // Set typed confirmation for type-to-confirm
  setTypedConfirmation: (requirementId: string, text: string) => void;

  // Complete a step in multi-step confirmation
  completeStep: (requirementId: string, stepId: string) => void;

  // Check if a specific requirement is satisfied
  isSatisfied: (requirement: ConfirmationRequirement) => boolean;

  // Reset all state
  reset: () => void;
}

export interface UseConfirmationWorkflowReturn
  extends UseConfirmationWorkflowState,
    UseConfirmationWorkflowActions {}

/**
 * Hook for managing confirmation workflow state
 *
 * @param requirements - List of confirmation requirements
 * @returns Confirmation state and actions
 */
export function useConfirmationWorkflow(
  requirements: ConfirmationRequirement[]
): UseConfirmationWorkflowReturn {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [typedConfirmations, setTypedConfirmations] = useState<Map<string, string>>(new Map());
  const [completedSteps, setCompletedSteps] = useState<Map<string, string[]>>(new Map());

  // Check if a specific requirement is satisfied
  const isSatisfied = useCallback(
    (requirement: ConfirmationRequirement): boolean => {
      switch (requirement.type) {
        case 'acknowledge':
        case 'explicit_confirm':
          return acknowledged.has(requirement.requirementId);

        case 'type_to_confirm': {
          const text = typedConfirmations.get(requirement.requirementId) || '';
          return text.toUpperCase() === 'CONFIRM';
        }

        case 'multi_step': {
          const steps = requirement.steps || [];
          const completed = completedSteps.get(requirement.requirementId) || [];
          return steps.every(step => completed.includes(step.stepId));
        }

        default:
          return false;
      }
    },
    [acknowledged, typedConfirmations, completedSteps]
  );

  // Check if all requirements are satisfied
  const allSatisfied = useMemo(() => {
    return requirements.every(req => isSatisfied(req));
  }, [requirements, isSatisfied]);

  // Build acknowledgments array
  const acknowledgments = useMemo((): ConfirmationAcknowledgment[] => {
    return requirements.map(req => ({
      requirementId: req.requirementId,
      typedConfirmation: typedConfirmations.get(req.requirementId),
      completedSteps: completedSteps.get(req.requirementId),
    }));
  }, [requirements, typedConfirmations, completedSteps]);

  // Acknowledge a requirement
  const acknowledge = useCallback((requirementId: string) => {
    setAcknowledged(prev => new Set([...prev, requirementId]));
  }, []);

  // Set typed confirmation
  const setTypedConfirmation = useCallback((requirementId: string, text: string) => {
    setTypedConfirmations(prev => {
      const next = new Map(prev);
      next.set(requirementId, text);
      return next;
    });
  }, []);

  // Complete a step
  const completeStep = useCallback((requirementId: string, stepId: string) => {
    setCompletedSteps(prev => {
      const next = new Map(prev);
      const existing = next.get(requirementId) || [];
      if (!existing.includes(stepId)) {
        next.set(requirementId, [...existing, stepId]);
      }
      return next;
    });
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setAcknowledged(new Set());
    setTypedConfirmations(new Map());
    setCompletedSteps(new Map());
  }, []);

  return {
    // State
    acknowledged,
    typedConfirmations,
    completedSteps,
    allSatisfied,
    acknowledgments,

    // Actions
    acknowledge,
    setTypedConfirmation,
    completeStep,
    isSatisfied,
    reset,
  };
}
