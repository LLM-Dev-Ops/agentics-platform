'use client';

/**
 * Workflow Phase Indicator
 *
 * Implements ADR/DDD #006: Claude-Flow Mental Model Parity
 *
 * Displays the current phase in the control surface workflow:
 * Plan -> Review -> Commit -> Inspect
 *
 * This mirrors the claude-flow staging model where actions are
 * planned, reviewed, committed, and then inspected.
 */

import { type WorkflowPhase } from '@/lib/intent-client';

interface WorkflowPhaseIndicatorProps {
  currentPhase: WorkflowPhase;
  category?: 'observation' | 'synthesis' | 'commitment';
}

const PHASES: { key: WorkflowPhase; label: string; description: string }[] = [
  { key: 'plan', label: 'Plan', description: 'Declare intent' },
  { key: 'review', label: 'Review', description: 'Preview changes' },
  { key: 'commit', label: 'Commit', description: 'Confirm execution' },
  { key: 'inspect', label: 'Inspect', description: 'View results' },
];

export function WorkflowPhaseIndicator({
  currentPhase,
  category = 'commitment',
}: WorkflowPhaseIndicatorProps) {
  // For observation/synthesis, commit phase is skipped
  const applicablePhases =
    category === 'observation' || category === 'synthesis'
      ? PHASES.filter(p => p.key !== 'commit')
      : PHASES;

  const currentIndex = applicablePhases.findIndex(p => p.key === currentPhase);

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between">
        {applicablePhases.map((phase, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <div key={phase.key} className="flex flex-1 items-center">
              {/* Phase circle and label */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold
                    ${isCompleted ? 'border-green-500 bg-green-500 text-white' : ''}
                    ${isCurrent ? 'border-primary-500 bg-primary-50 text-primary-700' : ''}
                    ${isUpcoming ? 'border-gray-300 bg-white text-gray-400' : ''}
                  `}
                >
                  {isCompleted ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCurrent ? 'text-primary-700' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {phase.label}
                </span>
                <span className="text-xs text-gray-400">{phase.description}</span>
              </div>

              {/* Connector line */}
              {index < applicablePhases.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 ${
                    index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
