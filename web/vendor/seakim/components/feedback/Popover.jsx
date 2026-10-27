import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Trigger-anchored contextual overlay — the third overlay species (0022).
 *
 * Two modes. modal (a reaction bar): a scrim, focus moves into the panel and is
 * trapped there loosely, dismiss on scrim-click or Escape. non-modal (a tooltip
 * or autocomplete, the default): no scrim, focus STAYS on the trigger, dismiss on
 * outside-click, Escape, or the trigger losing focus. Both flip to stay on-screen
 * and wear the overlay surface with `--shadow-popover` and a hairline border.
 *
 * The panel is `position: fixed`, placed from the trigger's rectangle, so a
 * scrolling or `overflow: hidden` ancestor never clips it (0022: an anchored
 * overlay escapes its parent's clip). `align` lines it up with the trigger's
 * left (start) or right (end) edge, kept inside the window, and it re-places on
 * scroll and resize. Caveat: an ancestor with a `transform` becomes the panel's frame.
 */
// Space between trigger and panel, and the least the panel keeps from the window's edge.
const GAP = 4;
const EDGE = 8;

export function Popover({ trigger, children, open, onDismiss, modal = false, side = 'bottom', align = 'start', style, ...rest }) {
  const anchorRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // modal takes focus; non-modal must not (a tooltip that steals focus is
    // broken for every AT user).
    if (modal && panelRef.current) panelRef.current.focus();

    function onKey(e) {
      if (e.key === 'Escape') onDismiss?.();
    }
    // Outside-press. modal dismisses via its scrim, so only the non-modal mode
    // needs a document listener.
    function onDocPointer(e) {
      if (modal) return;
      if (anchorRef.current && !anchorRef.current.contains(e.target)) onDismiss?.();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocPointer);
    };
  }, [open, modal, onDismiss]);

  // Placement from real measurements: on the preferred `side`, flipped to the
  // other when it does not fit there and the other side has more room.
  const [at, setAt] = useState(null);
  useLayoutEffect(() => {
    if (!open) {
      setAt(null);
      return undefined;
    }
    function place() {
      const a = anchorRef.current && anchorRef.current.getBoundingClientRect();
      const p = panelRef.current;
      if (!a || !p) return;
      const w = p.offsetWidth;
      const h = p.offsetHeight;
      const below = window.innerHeight - a.bottom;
      const fitsBelow = below >= h + GAP || below >= a.top;
      const fitsAbove = a.top >= h + GAP || a.top > below;
      const up = side === 'top' ? fitsAbove : !fitsBelow;
      // `start` lines up with the trigger's left edge, `end` with its right edge;
      // either is pulled back inside the window.
      let left = align === 'end' ? a.right - w : a.left;
      left = Math.max(EDGE, Math.min(left, window.innerWidth - EDGE - w));
      setAt({ top: up ? a.top - h - GAP : a.bottom + GAP, left });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, side, align]);
  // Until measured, the panel renders hidden at the origin so it can be sized.
  const pos = at ? { top: at.top, left: at.left } : { top: 0, left: 0, visibility: 'hidden' };

  return (
    <span ref={anchorRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger}
      {open && modal && (
        <div
          onClick={onDismiss}
          style={{
            position: 'fixed', inset: 0, zIndex: 'var(--z-modal, 300)',
            background: 'var(--surface-scrim)',
          }}
        />
      )}
      {open && (
        <div
          ref={panelRef}
          tabIndex={modal ? -1 : undefined}
          role={modal ? 'dialog' : 'tooltip'}
          aria-modal={modal || undefined}
          style={{
            position: 'fixed', ...pos, minWidth: 'max-content',
            zIndex: modal ? 'calc(var(--z-modal, 300) + 1)' : 'var(--z-popover, 250)',
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-popover)',
            borderRadius: 'var(--radius-xl)',
            outline: 'none',
            ...style,
          }}
          {...rest}
        >
          {children}
        </div>
      )}
    </span>
  );
}
