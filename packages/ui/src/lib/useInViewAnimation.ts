'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Gates panel animations on viewport + tab visibility. ADR-010.
 *
 * Returns a `{ ref, inView }` pair. Panels set `data-in-view={inView}` on
 * their root; CSS animations in globals.css key off `[data-in-view="true"]`.
 *
 * Why both IntersectionObserver and visibilityState: a panel scrolled into
 * view in a hidden tab should NOT burn frames. Covering both here keeps
 * widget authors from rediscovering the same bug.
 */
export function useInViewAnimation<T extends Element = HTMLDivElement>(
  options: { threshold?: number; rootMargin?: string } = {}
): { ref: React.RefObject<T>; inView: boolean } {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  const [tabActive, setTabActive] = useState(
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => setVisible(e.isIntersecting));
      },
      {
        threshold: options.threshold ?? 0.15,
        rootMargin: options.rootMargin ?? '0px 0px -5% 0px',
      }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [options.threshold, options.rootMargin]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => setTabActive(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return { ref, inView: visible && tabActive };
}
