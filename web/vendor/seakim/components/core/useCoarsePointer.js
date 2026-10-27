import { useState, useEffect } from 'react';

/**
 * True when the primary pointer is coarse (touch). Drives the 44px touch-surface
 * floor from decision 0023 — a floor for fingers, not for a desktop mouse.
 * SSR-safe: resolves to false until the browser reports otherwise.
 */
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return coarse;
}
