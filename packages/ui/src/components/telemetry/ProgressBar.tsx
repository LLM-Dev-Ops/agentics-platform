'use client';

import React from 'react';

/**
 * ADR-010 — progress bar with cyan fill, sheen sweep, and target %.
 * Target percent is passed via the --pb-target CSS variable so the
 * pb-deploy keyframe animates to the correct endpoint.
 */
export function ProgressBar({
  percent,
  label,
  animate = true,
}: {
  percent: number;
  label?: string;
  animate?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex flex-col gap-2">
      {(label || typeof percent === 'number') && (
        <div className="flex justify-between items-end">
          {label ? (
            <span className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
              {label}
            </span>
          ) : <span />}
          <span className="text-xs font-mono text-brand-cyan">{clamped}%</span>
        </div>
      )}
      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden shadow-panel-inner">
        <div
          className={`${animate ? 'pb-fill' : ''} h-full bg-brand-cyan rounded-full shadow-cyan-glow-sm relative overflow-hidden`}
          style={{
            ['--pb-target' as any]: `${clamped}%`,
            width: animate ? undefined : `${clamped}%`,
          }}
        >
          <div className="pb-sheen absolute top-0 bottom-0 w-[50%] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </div>
      </div>
    </div>
  );
}
