'use client';

import React from 'react';

/**
 * ADR-010 — circular gauge. `percent` 0..100 drives stroke offset.
 * When percent is provided we use a deterministic static offset;
 * otherwise the thermal-fluctuation CSS animation runs.
 */
export function ThermalGauge({
  value,
  caption,
  percent,
  warning = false,
}: {
  value: string | number;
  caption?: string;
  percent?: number;
  warning?: boolean;
}) {
  const r = 60;
  const circumference = 2 * Math.PI * r; // ≈ 377
  const offset =
    typeof percent === 'number'
      ? circumference * (1 - Math.max(0, Math.min(100, percent)) / 100)
      : 90;

  // ADR-010: SVG `stroke` cannot consume Tailwind utilities; route
  // through the CSS variable declared in globals.css so the brand hex
  // stays single-sourced.
  const stroke = warning ? '#f59e0b' : 'var(--brand-cyan)';
  const glow = warning
    ? 'drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]'
    : 'drop-shadow-[0_0_12px_rgba(40,202,235,0.5)]';
  const valueColor = warning ? 'text-amber-400' : 'text-brand-cyan';
  const valueGlow = warning
    ? 'drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]'
    : 'drop-shadow-[0_0_8px_rgba(40,202,235,0.4)]';

  return (
    <div className="flex flex-col items-center justify-center relative w-full h-full">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144">
          <circle cx="72" cy="72" r={r} fill="transparent" stroke="#18181b" strokeWidth="10" />
          <circle
            cx="72"
            cy="72"
            r={r}
            fill="transparent"
            stroke={stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`thermal-ring ${glow}`}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`text-3xl font-normal ${valueColor} tracking-tight ${valueGlow}`}>
            {value}
          </span>
          {caption ? (
            <span className="text-xs text-zinc-500 font-mono tracking-widest mt-1 uppercase">
              {caption}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
