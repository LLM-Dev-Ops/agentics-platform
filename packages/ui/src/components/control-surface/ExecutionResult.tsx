'use client';

/**
 * Execution Result
 *
 * Implements ADR/DDD #006: Inspect Phase
 *
 * Shows the outcome of executing an intent:
 * - Success/failure status
 * - Actual changes made
 * - Errors with details
 * - Duration and metadata
 */

import { type ExecutionResult as ExecutionResultType, type ActualChange } from '@/lib/intent-client';

interface ExecutionResultProps {
  result: ExecutionResultType;
  onClose?: () => void;
  onRetry?: () => void;
}

function ChangeRow({ change }: { change: ActualChange }) {
  const typeColors = {
    created: 'bg-green-100 text-green-800',
    updated: 'bg-blue-100 text-blue-800',
    deleted: 'bg-red-100 text-red-800',
  };

  return (
    <div className="flex items-start gap-3 rounded-md border border-gray-100 bg-gray-50 p-3">
      <span
        className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${typeColors[change.changeType]}`}
      >
        {change.changeType}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{change.resourceType}</span>
          <code className="rounded bg-gray-200 px-1 text-xs text-gray-600">
            {change.resourceId}
          </code>
        </div>
        <p className="mt-1 text-sm text-gray-600">{change.description}</p>
      </div>
    </div>
  );
}

export function ExecutionResult({ result, onClose, onRetry }: ExecutionResultProps) {
  const duration = result.durationMs < 1000
    ? `${result.durationMs}ms`
    : `${(result.durationMs / 1000).toFixed(2)}s`;

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div
        className={`rounded-lg p-4 ${
          result.success
            ? 'border border-green-200 bg-green-50'
            : 'border border-red-200 bg-red-50'
        }`}
      >
        <div className="flex items-center gap-3">
          {result.success ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
          <div>
            <h3
              className={`text-lg font-medium ${
                result.success ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {result.success ? 'Operation Completed Successfully' : 'Operation Failed'}
            </h3>
            <p className="text-sm text-gray-600">Completed in {duration}</p>
          </div>
        </div>
      </div>

      {/* Error details */}
      {result.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800">
                Error: {result.error.code}
              </h4>
              <p className="mt-1 text-sm text-red-700">{result.error.message}</p>
              {result.error.suggestedAction && (
                <p className="mt-2 text-sm text-red-600">
                  <span className="font-medium">Suggested action:</span>{' '}
                  {result.error.suggestedAction}
                </p>
              )}
              {result.error.retryable && (
                <p className="mt-2 text-xs text-red-600">This operation can be retried.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Result data */}
      {result.success && result.data && Object.keys(result.data).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-medium text-gray-900">Result Data</h4>
          <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}

      {/* Actual changes */}
      {result.actualChanges.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-900">Changes Made</h4>
          <div className="space-y-2">
            {result.actualChanges.map((change, index) => (
              <ChangeRow key={index} change={change} />
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-gray-500">Execution ID</dt>
            <dd className="font-mono text-gray-700">{result.executionId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Correlation ID</dt>
            <dd className="font-mono text-gray-700">{result.correlationId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Started</dt>
            <dd className="text-gray-700">{new Date(result.startedAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Completed</dt>
            <dd className="text-gray-700">{new Date(result.completedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t pt-4">
        {result.error?.retryable && onRetry && (
          <button
            onClick={onRetry}
            className="rounded-md border border-yellow-500 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
          >
            Retry
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
