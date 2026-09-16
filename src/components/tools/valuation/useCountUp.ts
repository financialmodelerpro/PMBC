'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number towards `target` over `ms`. With reduced motion requested,
 * or on the server, it returns the target immediately. When the target changes
 * (the exploration sliders), it counts from where it was, not from zero.
 */
export function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(target);
  const from = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setValue(target);
      return;
    }
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setValue(target);
      return;
    }
    const start = first.current ? 0 : from.current;
    first.current = false;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (target - start) * eased;
      from.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return value;
}
