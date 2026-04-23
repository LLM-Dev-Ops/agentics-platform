'use client';

import React from 'react';

export type PillStatus =
  | 'active'
  | 'stable'
  | 'pending'
  | 'warning'
  | 'critical'
  | 'idle';

/**
 * ADR-010 — one accent is cyan; red/amber retained for safety-critical
 * semantics. Zinc fallback for quiet states.
 */
const styleMap: Record<PillStatus, { dot: string; text: string; ring: string; bg: string }> = {
  active:   { dot: 'bg-brand-cyan shadow-cyan-glow-sm animate-pulse', text: 'text-brand-cyan',   ring: 'border-brand-cyan/40', bg: 'bg-brand-cyan-soft' },
  stable:   { dot: 'bg-brand-cyan',                                     text: 'text-brand-cyan',   ring: 'border-brand-cyan/30', bg: 'bg-brand-cyan-soft' },
  pending:  { dot: 'bg-zinc-500',                                       text: 'text-zinc-400',     ring: 'border-zinc-700',      bg: 'bg-zinc-900/50' },
  idle:     { dot: 'bg-zinc-600',                                       text: 'text-zinc-500',     ring: 'border-zinc-800',      bg: 'bg-zinc-900/40' },
  warning:  { dot: 'bg-amber-500 animate-pulse',                        text: 'text-amber-400',    ring: 'border-amber-900/50',  bg: 'bg-amber-950/20' },
  critical: { dot: 'bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]', text: 'text-red-400',      ring: 'border-red-900/50',    bg: 'bg-red-950/30' },
};

export function StatusPill({
  status,
  label,
  className = '',
}: {
  status: PillStatus;
  label?: string;
  className?: string;
}) {
  const s = styleMap[status];
  const text = label ?? status.toUpperCase();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${s.ring} ${s.bg} ${className}`}
      role="status"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={`text-xs font-mono uppercase tracking-widest ${s.text}`}>{text}</span>
    </span>
  );
}
