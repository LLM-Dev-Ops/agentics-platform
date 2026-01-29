'use client';

/**
 * Confirmation Workflow
 *
 * Implements ADR/DDD #006: INV-U4 Commitment Confirmation
 *
 * Enforces explicit confirmation for commitment intents.
 * Users must actively confirm each requirement - there are no
 * shortcuts or "skip" options for trusted users.
 *
 * This component intentionally creates friction for consequential
 * operations as a governance feature.
 */

import { useState, useCallback } from 'react';
import {
  type ConfirmationRequirement,
  type ConfirmationStep,
  type ConfirmationAcknowledgment,
} from '@/lib/intent-client';

interface ConfirmationWorkflowProps {
  requirements: ConfirmationRequirement[];
  onConfirm: (acknowledgments: ConfirmationAcknowledgment[]) => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

interface StepState {
  [requirementId: string]: {
    typedConfirmation?: string;
    completedSteps: string[];
  };
}

function AcknowledgeConfirmation({
  requirement,
  onAcknowledge,
}: {
  requirement: ConfirmationRequirement;
  onAcknowledge: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={requirement.requirementId}
          checked={acknowledged}
          onChange={e => {
            setAcknowledged(e.target.checked);
            if (e.target.checked) onAcknowledge();
          }}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor={requirement.requirementId} className="flex-1 cursor-pointer">
          <p className="text-sm font-medium text-gray-900">{requirement.description}</p>
          <p className="mt-1 text-xs text-gray-500">
            Check this box to acknowledge you understand the consequences.
          </p>
        </label>
      </div>
    </div>
  );
}

function ExplicitConfirmation({
  requirement,
  onConfirm,
}: {
  requirement: ConfirmationRequirement;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <p className="text-sm font-medium text-gray-900">{requirement.description}</p>
      <p className="mt-2 text-xs text-gray-600">
        This action requires explicit confirmation. Please review the details above carefully.
      </p>
      <button
        onClick={onConfirm}
        className="mt-3 rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
      >
        I confirm this action
      </button>
    </div>
  );
}

function MultiStepConfirmation({
  requirement,
  completedSteps,
  onStepComplete,
}: {
  requirement: ConfirmationRequirement;
  completedSteps: string[];
  onStepComplete: (stepId: string) => void;
}) {
  const steps = requirement.steps || [];
  const allCompleted = steps.every(step => completedSteps.includes(step.stepId));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">{requirement.description}</p>
      <p className="mt-1 text-xs text-gray-500">Complete all steps to proceed.</p>

      <div className="mt-4 space-y-3">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.stepId);
          const isPrevCompleted =
            index === 0 || completedSteps.includes(steps[index - 1].stepId);
          const isEnabled = isPrevCompleted && !isCompleted;

          return (
            <div
              key={step.stepId}
              className={`flex items-center gap-3 rounded-md p-3 ${
                isCompleted
                  ? 'bg-green-50'
                  : isEnabled
                    ? 'bg-white'
                    : 'bg-gray-50 opacity-60'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : 'border-2 border-gray-300 text-gray-500'
                }`}
              >
                {isCompleted ? (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step.stepNumber
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{step.description}</p>
              </div>
              {isEnabled && (
                <button
                  onClick={() => onStepComplete(step.stepId)}
                  className="rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700"
                >
                  Complete
                </button>
              )}
              {isCompleted && (
                <span className="text-xs text-green-600">Completed</span>
              )}
            </div>
          );
        })}
      </div>

      {allCompleted && (
        <div className="mt-3 rounded-md bg-green-100 p-2 text-center text-sm text-green-800">
          All steps completed
        </div>
      )}
    </div>
  );
}

function TypeToConfirmation({
  requirement,
  value,
  onChange,
}: {
  requirement: ConfirmationRequirement;
  value: string;
  onChange: (value: string) => void;
}) {
  const confirmText = 'CONFIRM';
  const isValid = value.toUpperCase() === confirmText;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-gray-900">{requirement.description}</p>
      <p className="mt-2 text-sm text-gray-600">
        Type <code className="rounded bg-red-100 px-1 font-mono">{confirmText}</code> to confirm
        this action.
      </p>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Type ${confirmText} here`}
        className={`mt-3 w-full rounded-md border px-3 py-2 text-sm ${
          isValid
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
        }`}
      />
      {isValid && (
        <p className="mt-1 text-xs text-green-600">Confirmation text matches</p>
      )}
    </div>
  );
}

export function ConfirmationWorkflow({
  requirements,
  onConfirm,
  onCancel,
  isConfirming = false,
}: ConfirmationWorkflowProps) {
  const [stepState, setStepState] = useState<StepState>(() => {
    const initial: StepState = {};
    requirements.forEach(req => {
      initial[req.requirementId] = {
        typedConfirmation: '',
        completedSteps: [],
      };
    });
    return initial;
  });

  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  const handleAcknowledge = useCallback((requirementId: string) => {
    setAcknowledged(prev => new Set([...prev, requirementId]));
  }, []);

  const handleStepComplete = useCallback((requirementId: string, stepId: string) => {
    setStepState(prev => ({
      ...prev,
      [requirementId]: {
        ...prev[requirementId],
        completedSteps: [...(prev[requirementId]?.completedSteps || []), stepId],
      },
    }));
  }, []);

  const handleTypeChange = useCallback((requirementId: string, value: string) => {
    setStepState(prev => ({
      ...prev,
      [requirementId]: {
        ...prev[requirementId],
        typedConfirmation: value,
      },
    }));
  }, []);

  const isAllSatisfied = requirements.every(req => {
    switch (req.type) {
      case 'acknowledge':
        return acknowledged.has(req.requirementId);
      case 'explicit_confirm':
        return acknowledged.has(req.requirementId);
      case 'multi_step':
        return (
          req.steps?.every(step =>
            stepState[req.requirementId]?.completedSteps.includes(step.stepId)
          ) ?? false
        );
      case 'type_to_confirm':
        return stepState[req.requirementId]?.typedConfirmation?.toUpperCase() === 'CONFIRM';
      default:
        return false;
    }
  });

  const handleSubmit = () => {
    const acknowledgments: ConfirmationAcknowledgment[] = requirements.map(req => ({
      requirementId: req.requirementId,
      typedConfirmation: stepState[req.requirementId]?.typedConfirmation,
      completedSteps: stepState[req.requirementId]?.completedSteps,
    }));
    onConfirm(acknowledgments);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Confirmation Required</h3>
        <p className="mt-1 text-sm text-gray-500">
          This action requires explicit confirmation. Please complete all requirements below.
        </p>
      </div>

      <div className="space-y-4">
        {requirements.map(requirement => (
          <div key={requirement.requirementId}>
            {requirement.type === 'acknowledge' && (
              <AcknowledgeConfirmation
                requirement={requirement}
                onAcknowledge={() => handleAcknowledge(requirement.requirementId)}
              />
            )}
            {requirement.type === 'explicit_confirm' && (
              <ExplicitConfirmation
                requirement={requirement}
                onConfirm={() => handleAcknowledge(requirement.requirementId)}
              />
            )}
            {requirement.type === 'multi_step' && (
              <MultiStepConfirmation
                requirement={requirement}
                completedSteps={stepState[requirement.requirementId]?.completedSteps || []}
                onStepComplete={stepId => handleStepComplete(requirement.requirementId, stepId)}
              />
            )}
            {requirement.type === 'type_to_confirm' && (
              <TypeToConfirmation
                requirement={requirement}
                value={stepState[requirement.requirementId]?.typedConfirmation || ''}
                onChange={value => handleTypeChange(requirement.requirementId, value)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <button
          onClick={onCancel}
          disabled={isConfirming}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isAllSatisfied || isConfirming}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isConfirming ? 'Confirming...' : 'Confirm and Execute'}
        </button>
      </div>

      {!isAllSatisfied && (
        <p className="text-center text-xs text-gray-500">
          Complete all confirmation requirements to proceed
        </p>
      )}
    </div>
  );
}
