'use client';

import React from 'react';

/**
 * ADR-010 — Quantum-relay signal uplink widget. Background signal-flow
 * texture animates behind a sweeping block. Both are gated by
 * data-in-view on the parent Panel.
 */
export function SignalUplink({
  transmitting = true,
  statusLabel = 'Transmitting',
}: {
  transmitting?: boolean;
  statusLabel?: string;
}) {
  return (
    <div className="w-full relative py-4">
      <div className="flex items-center gap-2 mb-3 justify-end">
        <span className="text-[10px] font-mono text-brand-cyan uppercase tracking-widest animate-pulse">
          {statusLabel}
        </span>
        <div className="flex gap-0.5" aria-hidden="true">
          <div className="w-1 h-3 bg-brand-cyan rounded-sm animate-[pulse_1s_ease-in-out_infinite]" />
          <div className="w-1 h-3 bg-brand-cyan rounded-sm animate-[pulse_1s_ease-in-out_infinite_0.2s]" />
          <div className="w-1 h-3 bg-brand-cyan rounded-sm animate-[pulse_1s_ease-in-out_infinite_0.4s]" />
        </div>
      </div>

      <div className="h-10 w-full bg-surface-panel rounded-lg border border-zinc-800 shadow-panel-inner relative overflow-hidden">
        <div className="absolute inset-0 signal-texture opacity-25" />

        <div className="absolute inset-y-0 right-0 w-[15%] border-l border-brand-cyan/30 border-dashed flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-brand-cyan shadow-cyan-glow-sm" />
        </div>
        <div className="absolute inset-y-0 left-0 w-[15%] border-r border-brand-cyan/30 border-dashed flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-brand-cyan shadow-cyan-glow-sm" />
        </div>

        {transmitting && (
          <div className="sweep-block absolute inset-y-0 bg-brand-cyan/20 border-x border-brand-cyan shadow-[inset_0_0_20px_rgba(40,202,235,0.5)] flex items-center justify-between px-2 z-10">
            <div className="w-px h-6 bg-brand-cyan/80 shadow-cyan-glow-sm" />
            <div className="w-px h-6 bg-brand-cyan/80 shadow-cyan-glow-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
