import React from 'react';
import { useMeasuredBreakpoint } from '../core/useMeasuredBreakpoint.js';

// layout.md's content ceilings. `list` is single-column lists and feeds.
const CEILINGS = { list: '48rem', form: '620px', prose: '68ch', full: 'none' };

/**
 * Page padding for a breakpoint, per layout.md: 16 at the sides and top on a
 * phone, 20 and 24 from `md`, a larger bottom (40, 64) so the last row has air
 * under it. Flutter's `skPagePad(bp)` returns the same values.
 */
export function pagePad(bp) {
  return bp === 'sm'
    ? 'var(--space-5) var(--space-5) var(--space-9)'
    : 'var(--space-7) var(--space-6) var(--space-11)';
}

/**
 * The body of a page inside the shell's main area: `pagePad` for the measured
 * breakpoint outside, a `width` ceiling inside (`list` 48rem, `form` 620px,
 * `prose` 68ch, `full`), the column centred. A route, its loading state and its
 * error state all wrap in the same one, so they cannot disagree about where the
 * content starts. Measures its own container; does not scroll.
 */
export function PageBody({ width, children, style, ...rest }) {
  const { ref, bp } = useMeasuredBreakpoint();
  return (
    <div ref={ref} style={style} {...rest}>
      <div style={{ padding: pagePad(bp), maxWidth: CEILINGS[width] || 'none', margin: '0 auto', boxSizing: 'content-box' }}>
        {children}
      </div>
    </div>
  );
}
