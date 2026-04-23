'use client';

import React from 'react';

/**
 * ADR-010 — large-number display with mono-uppercase caption.
 * Accent defaults to cyan; amber/red available for safety states.
 */
export function MetricValue({
  value,
  caption,
  accent = 'cyan',
  size = 'md',
  glow = true,
  className = '',
}: {
  value: string | number;
  caption?: string;
  accent?: 'cyan' | 'zinc' | 'amber' | 'red';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  className?: string;
}) {
  const color =
    accent === 'cyan'  ? 'text-brand-cyan' :
    accent === 'amber' ? 'text-amber-400'  :
    accent === 'red'   ? 'text-red-400'    :
                         'text-zinc-200';

  const glowCls =
    glow && accent === 'cyan'  ? 'drop-shadow-[0_0_8px_rgba(40,202,235,0.45)]' :
    glow && accent === 'amber' ? 'drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]'  :
    '';

  const sizeCls =
    size === 'sm' ? 'text-xl'   :
    size === 'lg' ? 'text-4xl'  :
                    'text-2xl';

  return (
    <div className={`flex flex-col ${className}`}>
      <span className={`font-normal tracking-tight ${sizeCls} ${color} ${glowCls}`}>{value}</span>
      {caption ? (
        <span className="text-xs text-zinc-500 font-mono uppercase tracking-widest mt-0.5">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
