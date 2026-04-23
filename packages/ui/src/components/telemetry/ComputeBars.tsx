'use client';

import React from 'react';

export type ComputeBar = {
  label: string;
  /** Rendered as a bar height via inline style; CSS keyframes still
   *  animate if `animate` is true. 0..1 scale. */
  value: number;
  max?: boolean;
};

/**
 * ADR-010 — three-bar compute/throughput visual. If `animate` is true,
 * the bars use keyed CSS animations for idle shimmer; when live data
 * is present, pass `animate={false}` and the heights reflect `value`.
 */
export function ComputeBars({
  bars,
  animate = false,
}: {
  bars: [ComputeBar, ComputeBar, ComputeBar];
  animate?: boolean;
}) {
  const keyClass = ['compute-bar-1', 'compute-bar-2', 'compute-bar-3'] as const;

  return (
    <div className="flex-1 bg-surface-panel rounded-xl border border-zinc-800 p-4 shadow-panel-inner relative flex items-end justify-center gap-4">
      <div className="absolute inset-x-4 top-4 border-b border-dashed border-zinc-800" />
      <div className="absolute inset-x-4 top-1/2 border-b border-dashed border-zinc-800" />

      {bars.map((bar, i) => {
        const heightPx = Math.max(8, Math.min(112, Math.round(bar.value * 112)));
        return (
          <div key={bar.label} className="relative flex flex-col items-center w-12 z-10">
            {bar.max && (
              <div className="absolute -top-6 bg-zinc-800 border border-zinc-700 text-brand-cyan text-xs font-mono px-1.5 py-0.5 rounded tracking-widest uppercase">
                Max
              </div>
            )}
            <div
              className={`w-full ${animate ? keyClass[i] : ''} rounded-t shadow-cyan-glow-sm`}
              style={{
                height: animate ? undefined : `${heightPx}px`,
                // ADR-010: inline gradient cannot be expressed in Tailwind;
                // `--brand-cyan` keeps this single-sourced via globals.css.
                background:
                  'linear-gradient(to top, rgb(14 116 144), var(--brand-cyan))',
              }}
            />
            <span className="text-xs text-zinc-500 font-mono mt-2 uppercase tracking-widest absolute -bottom-6">
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
