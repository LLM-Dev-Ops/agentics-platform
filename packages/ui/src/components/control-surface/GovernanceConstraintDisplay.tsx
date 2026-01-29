'use client';

/**
 * Governance Constraint Display
 *
 * Implements ADR/DDD #006: INV-U5 Governance Visibility
 *
 * Displays governance constraints and warnings to the user.
 * Constraints are NEVER hidden - the UI surfaces all governance
 * information so users understand the rules.
 */

import { type GovernanceConstraint, type GovernanceWarning } from '@/lib/intent-client';

interface GovernanceConstraintDisplayProps {
  constraints: GovernanceConstraint[];
  warnings: GovernanceWarning[];
  showAll?: boolean;
}

function ConstraintIcon({ severity }: { severity: 'info' | 'warning' | 'blocking' }) {
  if (severity === 'blocking') {
    return (
      <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (severity === 'warning') {
    return (
      <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ConstraintCard({ constraint }: { constraint: GovernanceConstraint }) {
  const bgColors = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
    blocking: 'bg-red-50 border-red-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${bgColors[constraint.severity]}`}>
      <div className="flex items-start gap-3">
        <ConstraintIcon severity={constraint.severity} />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{constraint.description}</p>
          <p className="mt-1 text-xs text-gray-500">Source: {constraint.sourceRule}</p>
          {constraint.satisfied !== undefined && (
            <p className="mt-1 text-xs">
              <span
                className={constraint.satisfied ? 'text-green-600' : 'text-gray-500'}
              >
                {constraint.satisfied ? 'Satisfied' : 'Pending'}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function WarningCard({ warning }: { warning: GovernanceWarning }) {
  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <div className="flex items-start gap-3">
        <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{warning.message}</p>
          {warning.suggestedAction && (
            <p className="mt-1 text-xs text-gray-600">
              Suggestion: {warning.suggestedAction}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function GovernanceConstraintDisplay({
  constraints,
  warnings,
  showAll = false,
}: GovernanceConstraintDisplayProps) {
  // Always show blocking constraints, optionally show info
  const visibleConstraints = showAll
    ? constraints
    : constraints.filter(c => c.severity !== 'info');

  const blockingCount = constraints.filter(c => c.severity === 'blocking').length;
  const warningCount = constraints.filter(c => c.severity === 'warning').length;

  if (visibleConstraints.length === 0 && warnings.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium text-green-800">
            All governance constraints satisfied
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center gap-4 text-sm">
        <span className="font-medium text-gray-700">Governance Status:</span>
        {blockingCount > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <ConstraintIcon severity="blocking" />
            {blockingCount} blocking
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-yellow-600">
            <ConstraintIcon severity="warning" />
            {warningCount} warnings
          </span>
        )}
        {warnings.length > 0 && (
          <span className="flex items-center gap-1 text-yellow-600">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z"
                clipRule="evenodd"
              />
            </svg>
            {warnings.length} advisories
          </span>
        )}
      </div>

      {/* Constraints list */}
      {visibleConstraints.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Constraints</h4>
          <div className="space-y-2">
            {visibleConstraints.map(constraint => (
              <ConstraintCard key={constraint.constraintId} constraint={constraint} />
            ))}
          </div>
        </div>
      )}

      {/* Warnings list */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Warnings</h4>
          <div className="space-y-2">
            {warnings.map(warning => (
              <WarningCard key={warning.warningId} warning={warning} />
            ))}
          </div>
        </div>
      )}

      {/* Show all toggle */}
      {!showAll && constraints.filter(c => c.severity === 'info').length > 0 && (
        <p className="text-xs text-gray-500">
          {constraints.filter(c => c.severity === 'info').length} informational constraints hidden
        </p>
      )}
    </div>
  );
}
