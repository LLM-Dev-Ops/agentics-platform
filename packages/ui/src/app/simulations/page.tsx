'use client';

/**
 * ADR-012 — Simulations list page. Hydrates from GET /v1/simulate via
 * React Query; newest first. Each row links into the live console.
 */

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { TerminalSquare } from 'lucide-react';
import { StatusPill, type PillStatus } from '@/components/telemetry';
import { listSimulations, type SimulationListItem } from '@/lib/api-client';

function mapStatus(s: SimulationListItem['status']): PillStatus {
  switch (s) {
    case 'running':   return 'active';
    case 'completed': return 'stable';
    case 'failed':    return 'critical';
    case 'cancelled': return 'warning';
    case 'pending':
    default:          return 'pending';
  }
}

export default function SimulationsListPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['simulations'],
    queryFn: listSimulations,
    refetchInterval: 5_000,
  });

  const items = data ?? [];

  return (
    <div className="telemetry-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex items-center gap-3">
          <TerminalSquare className="w-6 h-6 text-zinc-500" />
          <h1 className="text-3xl font-normal tracking-tight text-zinc-100">Simulations</h1>
        </div>

        {isLoading && (
          <div className="text-sm text-zinc-400 font-mono">Loading simulations...</div>
        )}
        {error && (
          <div className="text-sm text-red-400 font-mono">
            Failed to load simulations. {String((error as Error).message)}
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="cmd-panel p-6">
            <p className="text-zinc-400">
              No simulations yet. Start one from the CLI:
            </p>
            <pre className="mt-3 text-sm text-brand-cyan font-mono">
              agentics simulate --prompt &quot;Describe your scenario&quot; --follow
            </pre>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {items.map((sim) => (
            <Link
              key={sim.simulation_id}
              href={`/simulations/${encodeURIComponent(sim.simulation_id)}`}
              className="cmd-panel px-4 py-3 flex items-center justify-between hover:border-brand-cyan/40 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <StatusPill status={mapStatus(sim.status)} />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-zinc-200 truncate">
                    {sim.name ?? sim.simulation_id}
                  </span>
                  <span className="text-xs font-mono text-zinc-500 truncate">
                    {sim.simulation_id}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs font-mono text-zinc-400">
                {typeof sim.progress === 'number' && <span>{sim.progress}%</span>}
                <span>{sim.updated_at ?? sim.created_at ?? ''}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
