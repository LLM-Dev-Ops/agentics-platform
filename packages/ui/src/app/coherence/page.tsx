'use client';

/**
 * Coherence Page
 *
 * Implements ADR/DDD #005 and #006: System Coherence and Control Surface
 *
 * This page provides a control surface for coherence operations:
 * - View drift findings (Observation intent)
 * - Acknowledge drift (Commitment intent with confirmation)
 * - View pending decisions (Observation intent)
 * - Resolve decisions (Commitment intent with multi-step confirmation)
 *
 * All operations follow the Plan -> Review -> Commit -> Inspect workflow.
 */

import { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  WorkflowPhaseIndicator,
  GovernanceConstraintDisplay,
  PreviewPanel,
  ConfirmationWorkflow,
  ExecutionResult,
} from '@/components/control-surface';
import { useIntent } from '@/hooks/useIntent';
import type { Intent, PreviewData, ConfirmationRequirement, WorkflowPhase } from '@/lib/intent-client';

// =============================================================================
// Types (matching backend coherence types)
// =============================================================================

interface DriftFinding {
  id: string;
  type: 'semantic' | 'structural' | 'lineage' | 'integration';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  source: {
    sourceType: string;
    sourceId: string;
    name: string;
    path?: string;
  };
  expected: {
    asOf: string;
    value: Record<string, unknown>;
    hash: string;
    origin: string;
  };
  actual: {
    asOf: string;
    value: Record<string, unknown>;
    hash: string;
    origin: string;
  };
  detectedAt: string;
  correlationId: string;
  governanceReference?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

interface DriftStatistics {
  total: number;
  unacknowledged: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

interface PendingDecision {
  decisionId: string;
  category: string;
  status: string;
  subject: {
    subjectType: string;
    subjectId: string;
    description: string;
    proposedAction: Record<string, unknown>;
  };
  initiatedBy: string;
  initiatedAt: string;
}

interface CoherenceStatus {
  status: 'coherent' | 'degraded' | 'incoherent' | 'unknown';
  unacknowledgedDrift: number;
  pendingDecisions: number;
  criticalAlerts: number;
  timestamp: string;
}

// =============================================================================
// API Client Extensions (would be in a separate file in production)
// =============================================================================

const coherenceApi = {
  async getStatus(): Promise<CoherenceStatus> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/coherence/status`,
      {
        headers: { Authorization: `Bearer ${await getToken()}` },
      }
    );
    if (!response.ok) throw new Error('Failed to fetch coherence status');
    return response.json();
  },

  async getDriftFindings(): Promise<{ findings: DriftFinding[]; statistics: DriftStatistics }> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/coherence/drift`,
      {
        headers: { Authorization: `Bearer ${await getToken()}` },
      }
    );
    if (!response.ok) throw new Error('Failed to fetch drift findings');
    return response.json();
  },

  async getPendingDecisions(): Promise<{ pending: PendingDecision[] }> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/coherence/decisions`,
      {
        headers: { Authorization: `Bearer ${await getToken()}` },
      }
    );
    if (!response.ok) throw new Error('Failed to fetch pending decisions');
    return response.json();
  },
};

async function getToken(): Promise<string | null> {
  try {
    const { getSupabase } = await import('@/lib/supabase');
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

// =============================================================================
// Components
// =============================================================================

function StatusCard({ status }: { status: CoherenceStatus }) {
  const statusColors = {
    coherent: 'bg-green-100 border-green-200 text-green-800',
    degraded: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    incoherent: 'bg-red-100 border-red-200 text-red-800',
    unknown: 'bg-gray-100 border-gray-200 text-gray-800',
  };

  return (
    <div className={`rounded-lg border p-6 ${statusColors[status.status]}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold capitalize">System: {status.status}</h2>
          <p className="text-sm opacity-75">
            Last assessed: {new Date(status.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="text-right text-sm">
          <p>{status.unacknowledgedDrift} unacknowledged drift findings</p>
          <p>{status.pendingDecisions} pending decisions</p>
          <p>{status.criticalAlerts} critical alerts</p>
        </div>
      </div>
    </div>
  );
}

function DriftFindingCard({
  finding,
  onAcknowledge,
}: {
  finding: DriftFinding;
  onAcknowledge: (finding: DriftFinding) => void;
}) {
  const severityColors = {
    info: 'border-blue-200 bg-blue-50',
    warning: 'border-yellow-200 bg-yellow-50',
    critical: 'border-red-200 bg-red-50',
  };

  const typeLabels = {
    semantic: 'Semantic Drift',
    structural: 'Structural Drift',
    lineage: 'Lineage Drift',
    integration: 'Integration Drift',
  };

  return (
    <div className={`rounded-lg border p-4 ${severityColors[finding.severity]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                finding.severity === 'critical'
                  ? 'bg-red-200 text-red-800'
                  : finding.severity === 'warning'
                    ? 'bg-yellow-200 text-yellow-800'
                    : 'bg-blue-200 text-blue-800'
              }`}
            >
              {finding.severity.toUpperCase()}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {typeLabels[finding.type]}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-800">{finding.description}</p>
          <div className="mt-2 text-xs text-gray-500">
            <span>Source: {finding.source.name}</span>
            <span className="mx-2">|</span>
            <span>Detected: {new Date(finding.detectedAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="ml-4">
          {finding.acknowledged ? (
            <span className="text-xs text-green-600">
              Acknowledged by {finding.acknowledgedBy}
            </span>
          ) : (
            <button
              onClick={() => onAcknowledge(finding)}
              className="rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700"
            >
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionCard({
  decision,
  onResolve,
}: {
  decision: PendingDecision;
  onResolve: (decision: PendingDecision) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              {decision.category.replace('_', ' ')}
            </span>
            <span className="text-sm text-gray-500">
              {decision.subject.subjectType}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-gray-900">
            {decision.subject.description}
          </p>
          <div className="mt-2 text-xs text-gray-500">
            <span>Initiated by {decision.initiatedBy}</span>
            <span className="mx-2">|</span>
            <span>{new Date(decision.initiatedAt).toLocaleString()}</span>
          </div>
        </div>
        <button
          onClick={() => onResolve(decision)}
          className="ml-4 rounded-md border border-primary-600 px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
        >
          Review & Resolve
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function CoherencePage() {
  // Data state
  const [status, setStatus] = useState<CoherenceStatus | null>(null);
  const [driftFindings, setDriftFindings] = useState<DriftFinding[]>([]);
  const [driftStats, setDriftStats] = useState<DriftStatistics | null>(null);
  const [pendingDecisions, setPendingDecisions] = useState<PendingDecision[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Intent workflow state for acknowledgment
  const intentHook = useIntent();

  // Active tab
  const [activeTab, setActiveTab] = useState<'drift' | 'decisions'>('drift');

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [statusData, driftData, decisionsData] = await Promise.all([
        coherenceApi.getStatus(),
        coherenceApi.getDriftFindings(),
        coherenceApi.getPendingDecisions(),
      ]);

      setStatus(statusData);
      setDriftFindings(driftData.findings);
      setDriftStats(driftData.statistics);
      setPendingDecisions(decisionsData.pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coherence data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle drift acknowledgment (Commitment intent)
  const handleAcknowledgeDrift = useCallback(
    async (finding: DriftFinding) => {
      // Declare intent to acknowledge drift
      const intent = await intentHook.declare({
        domain: 'coherence',
        action: 'acknowledge_drift',
        payload: {
          findingId: finding.id,
          findingType: finding.type,
          findingSeverity: finding.severity,
        },
      });

      if (intent && intent.governanceResult?.permitted) {
        // Load preview
        await intentHook.loadPreview();
      }
    },
    [intentHook]
  );

  // Handle intent confirmation and execution
  const handleConfirmAndExecute = useCallback(
    async (acknowledgments: { requirementId: string }[]) => {
      const confirmed = await intentHook.confirm(acknowledgments);
      if (confirmed) {
        const result = await intentHook.execute();
        if (result?.success) {
          // Reload data
          loadData();
        }
      }
    },
    [intentHook, loadData]
  );

  // Render loading state
  if (isLoading && !status) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading coherence data...</div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-800">Error Loading Coherence Data</h2>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if we're in an intent workflow
  const isInWorkflow = intentHook.intent !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">System Coherence</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor system coherence, drift findings, and pending decisions.
          </p>
        </div>

        {/* Status card */}
        {status && <StatusCard status={status} />}

        {/* Intent workflow overlay */}
        {isInWorkflow && (
          <div className="mt-6 rounded-lg border border-primary-200 bg-white p-6 shadow-sm">
            <WorkflowPhaseIndicator
              currentPhase={intentHook.phase}
              category={intentHook.intent?.category}
            />

            {/* Review phase - show preview */}
            {intentHook.phase === 'review' && intentHook.preview && (
              <div className="mt-4 space-y-4">
                <PreviewPanel preview={intentHook.preview} />
                {intentHook.intent?.governanceResult && (
                  <GovernanceConstraintDisplay
                    constraints={intentHook.intent.governanceResult.constraints}
                    warnings={intentHook.intent.governanceResult.warnings}
                  />
                )}

                {/* Show confirmation workflow for commitments */}
                {intentHook.intent?.category === 'commitment' &&
                  intentHook.intent.governanceResult?.requiredConfirmations && (
                    <ConfirmationWorkflow
                      requirements={intentHook.intent.governanceResult.requiredConfirmations}
                      onConfirm={handleConfirmAndExecute}
                      onCancel={() => {
                        intentHook.cancel('User cancelled');
                        intentHook.reset();
                      }}
                      isConfirming={intentHook.isConfirming || intentHook.isExecuting}
                    />
                  )}
              </div>
            )}

            {/* Inspect phase - show result */}
            {intentHook.phase === 'inspect' && intentHook.result && (
              <div className="mt-4">
                <ExecutionResult
                  result={intentHook.result}
                  onClose={() => intentHook.reset()}
                />
              </div>
            )}

            {/* Error display */}
            {intentHook.error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{intentHook.error}</p>
                <button
                  onClick={intentHook.clearError}
                  className="mt-2 text-xs text-red-600 underline"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        {!isInWorkflow && (
          <>
            <div className="mt-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('drift')}
                  className={`border-b-2 px-1 py-4 text-sm font-medium ${
                    activeTab === 'drift'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Drift Findings
                  {driftStats && driftStats.unacknowledged > 0 && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">
                      {driftStats.unacknowledged}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('decisions')}
                  className={`border-b-2 px-1 py-4 text-sm font-medium ${
                    activeTab === 'decisions'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Pending Decisions
                  {pendingDecisions.length > 0 && (
                    <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                      {pendingDecisions.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Drift findings tab */}
            {activeTab === 'drift' && (
              <div className="mt-6 space-y-4">
                {driftFindings.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                    <p className="text-gray-500">No drift findings detected.</p>
                  </div>
                ) : (
                  driftFindings.map(finding => (
                    <DriftFindingCard
                      key={finding.id}
                      finding={finding}
                      onAcknowledge={handleAcknowledgeDrift}
                    />
                  ))
                )}
              </div>
            )}

            {/* Decisions tab */}
            {activeTab === 'decisions' && (
              <div className="mt-6 space-y-4">
                {pendingDecisions.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                    <p className="text-gray-500">No pending decisions.</p>
                  </div>
                ) : (
                  pendingDecisions.map(decision => (
                    <DecisionCard
                      key={decision.decisionId}
                      decision={decision}
                      onResolve={() => {
                        // Would implement decision resolution workflow
                        alert('Decision resolution workflow not yet implemented');
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
