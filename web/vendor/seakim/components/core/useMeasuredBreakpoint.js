import { useState, useEffect, useRef } from 'react';

/* Responsive plumbing shared by the kit frames and the layout components.

   Every SeaKim screen is ONE layout that reflows — there is no separate mobile
   build. Because the system styles inline rather than with stylesheets, screens
   cannot use CSS media queries, so they branch on a measured CONTAINER width
   instead. That is stricter than a media query: a screen embedded in a narrow
   panel reflows the same way it would on a phone.

   Breakpoints (see tokens/layout.css):
     sm  < 640    one column, tab bar, tappable rows, 44px targets
     md  640–1023 two columns where it helps, side nav collapses to icons
     lg  >= 1024  full chrome, dense tables, side rails */

export const BREAKPOINTS = { sm: 0, md: 640, lg: 1024 };

export function breakpointFor(width) {
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  return 'sm';
}

/** Measures its own element and reports {ref, width, bp}. SSR-safe: `lg` until measured. */
export function useMeasuredBreakpoint() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(Math.round(e.contentRect.width));
    });
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return { ref, width, bp: breakpointFor(width || 1440) };
}

/**
 * The window's breakpoint, for the one kind of component that is not in a
 * container: an overlay. Everything else measures its container. SSR-safe:
 * `lg` until the browser answers.
 */
export function useWindowBreakpoint() {
  const [bp, setBp] = useState('lg');
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const md = window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`);
    const lg = window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`);
    const update = () => setBp(lg.matches ? 'lg' : md.matches ? 'md' : 'sm');
    update();
    md.addEventListener('change', update);
    lg.addEventListener('change', update);
    return () => { md.removeEventListener('change', update); lg.removeEventListener('change', update); };
  }, []);
  return bp;
}
