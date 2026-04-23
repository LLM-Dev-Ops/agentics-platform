'use client';

/**
 * ADR-012 — Simulation Live Console (per-simulation view).
 *
 * Composition matches ADR-012 panel-to-data binding table. Every
 * widget pulls from the `useSimulationEvents` snapshot; panels render
 * inside ADR-010 `<Panel>` primitives which gate their animations by
 * viewport/tab visibility.
 */

import React from 'react';
import { useParams } from 'next/navigation';
import { TerminalSquare, Satellite, ExternalLink } from 'lucide-react';
import {
  Panel,
  PanelHeader,
  PanelBody,
  StatusPill,
  MetricValue,
  RadarSweep,
  ThermalGauge,
  ProgressBar,
  SignalUplink,
  ComputeBars,
  EventLogTable,
} from '@/components/telemetry';
import { useSimulationEvents, type StreamState } from '@/lib/useSimulationEvents';

function streamPillStatus(s: StreamState) {
  if (s === 'live') return 'active' as const;
  if (s === 'connecting') return 'pending' as const;
  if (s === 'ended') return 'stable' as const;
  return 'critical' as const;
}

export default function SimulationLiveConsolePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { snapshot, streamState } = useSimulationEvents(id);

  const progressPct = snapshot.totalSteps
    ? Math.min(100, Math.round((snapshot.completedSteps / snapshot.totalSteps) * 100))
    : snapshot.status === 'completed'
    ? 100
    : 0;

  const tokenBudget = 100_000;
  const tokenPct = Math.min(100, Math.round((snapshot.tokensUsed / tokenBudget) * 100));

  const active = snapshot.status === 'running';
  const scanPillStatus = active ? 'active' : snapshot.status === 'completed' ? 'stable' : 'idle';

  return (
    <div className="telemetry-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-normal tracking-tight text-zinc-100 flex items-center gap-3">
            <TerminalSquare className="w-6 h-6 text-zinc-500" />
            Live Telemetry Operations
          </h2>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Real-time surveillance of an in-flight simulation. Streaming via SSE
            (ADR-011) from the platform API.
          </p>
          <div className="mt-3 text-xs font-mono text-zinc-500">
            simulation_id: <span className="text-brand-cyan">{id}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Node Scan */}
          <Panel colSpan={1} className="h-[280px]">
            <PanelHeader>
              <div className="flex flex-col gap-1">
                <span className="cmd-label-cyan">Zone Alpha</span>
                <span className="text-base font-normal text-zinc-300">Node Scan</span>
              </div>
              <StatusPill status={scanPillStatus} />
            </PanelHeader>
            <PanelBody>
              <RadarSweep label="agent target" locationTag={snapshot.currentStep ?? 'idle'} />
            </PanelBody>
          </Panel>

          {/* Thermal Core — token budget */}
          <Panel colSpan={1} className="h-[280px]">
            <PanelHeader>
              <span className="cmd-label">Token Budget</span>
              <span className="text-xs font-mono text-zinc-500">{tokenBudget.toLocaleString()} cap</span>
            </PanelHeader>
            <PanelBody>
              <ThermalGauge
                value={snapshot.tokensUsed.toLocaleString()}
                caption="TOKENS"
                percent={tokenPct}
                warning={tokenPct > 80}
              />
            </PanelBody>
          </Panel>

          {/* System Logs */}
          <Panel colSpan={2} className="h-[280px]">
            <PanelHeader>
              <span className="text-lg font-normal text-zinc-300">System Logs</span>
              <span className="text-xs font-mono text-zinc-500">{snapshot.logs.length} events</span>
            </PanelHeader>
            <EventLogTable rows={snapshot.logs} emptyHint="Awaiting first event..." />
          </Panel>

          {/* Deployment Tasks — step progress */}
          <Panel colSpan={1} className="h-[280px]">
            <PanelHeader>
              <span className="text-base font-normal text-zinc-300">Simulation Steps</span>
              <StatusPill
                status={
                  snapshot.status === 'completed' ? 'stable' :
                  snapshot.status === 'failed'    ? 'critical' :
                  snapshot.status === 'cancelled' ? 'warning' :
                  snapshot.status === 'running'   ? 'active' : 'idle'
                }
                label={snapshot.status.toUpperCase()}
              />
            </PanelHeader>
            <PanelBody className="flex flex-col gap-4">
              <div className="bg-surface-panel rounded-xl p-4 border border-zinc-800 shadow-panel-inner flex flex-col gap-4">
                <p className="text-sm text-zinc-400 leading-relaxed truncate" title={snapshot.currentStep ?? ''}>
                  {snapshot.currentStep ?? 'Awaiting first step...'}
                </p>
                <ProgressBar percent={progressPct} label="Progress" animate={false} />
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <span className="text-xs font-mono">
                      {snapshot.completedSteps}/{snapshot.totalSteps ?? '?'}
                    </span>
                  </div>
                </div>
              </div>
            </PanelBody>
          </Panel>

          {/* Compute Usage */}
          <Panel colSpan={1} className="h-[280px]">
            <PanelHeader>
              <span className="text-base font-normal text-zinc-300">Compute Usage</span>
            </PanelHeader>
            <PanelBody className="flex flex-col">
              <ComputeBars
                animate={false}
                bars={[
                  { label: 'LLM', value: Math.min(1, snapshot.apiCalls / 50) },
                  { label: 'TOK', value: Math.min(1, snapshot.tokensUsed / tokenBudget), max: snapshot.tokensUsed > tokenBudget * 0.8 },
                  { label: 'ART', value: Math.min(1, snapshot.artifactsEmitted / 10) },
                ]}
              />
              <div className="mt-8 grid grid-cols-3 gap-2 px-1">
                <MetricValue size="sm" value={snapshot.apiCalls} caption="API CALLS" accent="zinc" glow={false} />
                <MetricValue size="sm" value={snapshot.tokensUsed} caption="TOKENS"    accent="cyan" />
                <MetricValue size="sm" value={snapshot.artifactsEmitted} caption="ARTIFACTS" accent="zinc" glow={false} />
              </div>
            </PanelBody>
          </Panel>

          {/* Quantum Relay — stream health */}
          <Panel colSpan={2} className="h-[280px]">
            <PanelHeader className="justify-start gap-3">
              <StatusPill status={streamPillStatus(streamState)} label={streamState.toUpperCase()} />
              <span className="text-xs text-zinc-400 font-mono uppercase tracking-widest">
                {snapshot.eventsReceived} events received
              </span>
            </PanelHeader>
            <PanelBody className="flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-normal text-zinc-300">SSE Relay</span>
              </div>
              <SignalUplink transmitting={streamState === 'live'} statusLabel={streamState.toUpperCase()} />
              <div className="flex justify-between items-end mt-auto">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">Transport</span>
                  <a
                    href={`/api/simulations/${encodeURIComponent(id)}/events`}
                    className="text-sm font-mono text-brand-cyan hover:opacity-80 flex items-center gap-1.5"
                    target="_blank"
                    rel="noreferrer"
                  >
                    /api/simulations/{id.slice(0, 8)}.../events
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <button
                  className="w-10 h-10 rounded-lg bg-surface-panel-3 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-brand-cyan"
                  aria-label="relay"
                >
                  <Satellite className="w-5 h-5" />
                </button>
              </div>
            </PanelBody>
          </Panel>
        </div>

        {snapshot.error && (
          <div className="mt-6 p-4 rounded-xl border border-red-900/50 bg-red-950/30 text-red-300 text-sm font-mono">
            {snapshot.error}
          </div>
        )}
      </div>
    </div>
  );
}
