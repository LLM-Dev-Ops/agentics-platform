'use client';

import React from 'react';
import { Crosshair } from 'lucide-react';

/**
 * ADR-010 — the radar-sweep ring. Animation is gated by the parent
 * Panel's data-in-view attribute; see globals.css.
 */
export function RadarSweep({
  label,
  locationTag,
  size = 128,
}: {
  label?: string;
  locationTag?: string;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center relative w-full h-full">
      <div
        className="rounded-full border border-zinc-800 relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-2 rounded-full border border-zinc-800/50" />
        <div className="absolute inset-0 rounded-full border border-brand-cyan/10" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-full h-px bg-brand-cyan" />
          <div className="h-full w-px bg-brand-cyan absolute" />
        </div>
        <div className="absolute inset-0 rounded-full radar-sweep" />
      </div>
      {(label || locationTag) && (
        <div className="w-full flex justify-between items-end absolute bottom-4 px-4">
          <span className="text-xs text-brand-cyan font-mono tracking-widest">
            {locationTag ?? ''}
          </span>
          <Crosshair className="w-4 h-4 text-brand-cyan" aria-label={label ?? 'radar target'} />
        </div>
      )}
    </div>
  );
}
