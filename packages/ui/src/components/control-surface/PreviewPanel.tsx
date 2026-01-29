'use client';

/**
 * Preview Panel
 *
 * Implements ADR/DDD #006: Review Phase
 *
 * Shows what will happen before execution:
 * - Proposed changes
 * - Impact assessment
 * - Affected resources
 *
 * Users review this before confirming execution.
 */

import { type PreviewData, type ProposedChange, type ImpactSummary } from '@/lib/intent-client';

interface PreviewPanelProps {
  preview: PreviewData;
}

function ChangeIcon({ type }: { type: 'create' | 'update' | 'delete' }) {
  if (type === 'create') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded bg-green-100 text-green-600">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  if (type === 'update') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-blue-600">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex h-6 w-6 items-center justify-center rounded bg-red-100 text-red-600">
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function ChangeCard({ change }: { change: ProposedChange }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <ChangeIcon type={change.changeType} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize text-gray-900">
              {change.changeType}
            </span>
            <span className="text-sm text-gray-500">{change.resourceType}</span>
            {change.resourceId && (
              <code className="rounded bg-gray-100 px-1 text-xs text-gray-600">
                {change.resourceId}
              </code>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">{change.description}</p>

          {/* Show changed fields for updates */}
          {change.changedFields && change.changedFields.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-gray-500">Changed fields: </span>
              <span className="text-xs font-mono text-gray-700">
                {change.changedFields.join(', ')}
              </span>
            </div>
          )}

          {/* Show before/after for updates */}
          {change.before && change.after && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-red-50 p-2">
                <span className="font-medium text-red-700">Before:</span>
                <pre className="mt-1 overflow-auto text-red-600">
                  {JSON.stringify(change.before, null, 2)}
                </pre>
              </div>
              <div className="rounded bg-green-50 p-2">
                <span className="font-medium text-green-700">After:</span>
                <pre className="mt-1 overflow-auto text-green-600">
                  {JSON.stringify(change.after, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactCard({ impact }: { impact: ImpactSummary }) {
  const riskColors = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="text-sm font-medium text-gray-900">Impact Assessment</h4>

      <div className="mt-3 space-y-3">
        {/* Risk level */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Risk Level:</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${riskColors[impact.riskLevel]}`}
          >
            {impact.riskLevel}
          </span>
        </div>

        {/* Reversibility */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Reversible:</span>
          {impact.reversible ? (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Yes
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-red-600">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              No - This action cannot be undone
            </span>
          )}
        </div>

        {/* Reversal method */}
        {impact.reversible && impact.reversalMethod && (
          <div>
            <span className="text-sm text-gray-600">To reverse: </span>
            <span className="text-sm text-gray-800">{impact.reversalMethod}</span>
          </div>
        )}

        {/* Affected resources */}
        {impact.affectedResources.length > 0 && (
          <div>
            <span className="text-sm font-medium text-gray-700">Affected Resources:</span>
            <ul className="mt-1 space-y-1">
              {impact.affectedResources.map((resource, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      resource.affectType === 'direct'
                        ? 'bg-blue-100 text-blue-700'
                        : resource.affectType === 'indirect'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {resource.affectType}
                  </span>
                  <span className="text-gray-600">
                    {resource.resourceType}/{resource.resourceId}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Downstream effects */}
        {impact.downstreamEffects.length > 0 && (
          <div>
            <span className="text-sm font-medium text-gray-700">Downstream Effects:</span>
            <ul className="mt-1 list-inside list-disc text-sm text-gray-600">
              {impact.downstreamEffects.map((effect, index) => (
                <li key={index}>{effect}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function PreviewPanel({ preview }: PreviewPanelProps) {
  const expiresAt = new Date(preview.expiresAt);
  const isExpired = Date.now() > expiresAt.getTime();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Preview: What Will Happen</h3>
        {isExpired ? (
          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
            Preview Expired
          </span>
        ) : (
          <span className="text-xs text-gray-500">
            Valid until {expiresAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Proposed changes */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Proposed Changes</h4>
        {preview.changes.length === 0 ? (
          <p className="text-sm text-gray-500">No changes will be made.</p>
        ) : (
          <div className="space-y-2">
            {preview.changes.map((change, index) => (
              <ChangeCard key={index} change={change} />
            ))}
          </div>
        )}
      </div>

      {/* Impact assessment */}
      <ImpactCard impact={preview.impact} />

      {/* Preview metadata */}
      <div className="text-xs text-gray-400">
        Preview ID: {preview.previewId} | Generated: {new Date(preview.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}
