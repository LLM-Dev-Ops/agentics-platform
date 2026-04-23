'use client';

import React from 'react';
import { useInViewAnimation } from '@/lib/useInViewAnimation';

/**
 * ADR-010 — the cmd-panel frame. All telemetry widgets wrap in this.
 * `data-in-view` is set on the root so animated children only run when
 * the panel is both scrolled into view and in a visible tab.
 */
export function Panel({
  children,
  className = '',
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: 1 | 2 | 3 | 4;
}) {
  const { ref, inView } = useInViewAnimation<HTMLDivElement>();
  const span = colSpan ? `lg:col-span-${colSpan}` : '';
  return (
    <div
      ref={ref}
      data-in-view={inView ? 'true' : 'false'}
      className={`cmd-panel flex flex-col ${span} ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`cmd-panel-header ${className}`}>{children}</div>;
}

export function PanelBody({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`cmd-panel-body ${className}`}>{children}</div>;
}
