'use client';

import React from 'react';
import { Check, AlertTriangle, Circle } from 'lucide-react';
import { StatusPill, type PillStatus } from './StatusPill';

export type EventLogRow = {
  id: string;
  ref: string;
  operation: string;
  state: PillStatus;
  timestamp: string;
  kind?: 'ok' | 'warning' | 'pending';
};

/**
 * ADR-010/ADR-012 — live event log table. Rows are announced via
 * aria-live="polite" so screen readers surface new events without
 * hijacking focus.
 */
export function EventLogTable({
  rows,
  emptyHint = 'Awaiting events...',
}: {
  rows: EventLogRow[];
  emptyHint?: string;
}) {
  return (
    <div className="flex flex-col flex-1 relative overflow-hidden">
      <div className="grid grid-cols-[auto_1fr_2fr_1fr_1fr] gap-4 px-4 py-3 border-b border-zinc-800/50 bg-surface-panel-2">
        <span className="text-xs text-zinc-600 font-mono tracking-widest uppercase w-6">CHK</span>
        <span className="text-xs text-zinc-600 font-mono tracking-widest uppercase">REF</span>
        <span className="text-xs text-zinc-600 font-mono tracking-widest uppercase">OPERATION</span>
        <span className="text-xs text-zinc-600 font-mono tracking-widest uppercase">STATE</span>
        <span className="text-xs text-zinc-600 font-mono tracking-widest uppercase text-right">TIMESTAMP</span>
      </div>

      <div
        className="flex flex-col overflow-y-auto max-h-full"
        aria-live="polite"
        aria-relevant="additions"
      >
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-zinc-500 font-mono">{emptyHint}</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className={
                row.kind === 'warning'
                  ? 'grid grid-cols-[auto_1fr_2fr_1fr_1fr] gap-4 px-4 py-3 items-center border-b border-amber-900/30 bg-amber-950/10 border-l-2 border-l-amber-500 relative'
                  : 'grid grid-cols-[auto_1fr_2fr_1fr_1fr] gap-4 px-4 py-3 items-center border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors'
              }
            >
              <div className="w-4 h-4 rounded flex items-center justify-center">
                {row.kind === 'warning' ? (
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                ) : row.kind === 'pending' ? (
                  <Circle className="w-3 h-3 text-zinc-600" />
                ) : (
                  <span className="w-4 h-4 rounded bg-brand-cyan flex items-center justify-center">
                    <Check className="w-3 h-3 text-surface-base" />
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-400 font-mono">{row.ref}</span>
              <span className="text-sm text-zinc-300 truncate" title={row.operation}>
                {row.operation}
              </span>
              <div>
                <StatusPill status={row.state} />
              </div>
              <span className="text-xs text-zinc-500 font-mono text-right">{row.timestamp}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
