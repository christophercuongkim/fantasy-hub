import React from 'react';
import { useMeasuredBreakpoint } from '../core/useMeasuredBreakpoint.js';
import { pagePad } from './PageBody.jsx';

/**
 * layout.md pattern 2, content + rail: a detail screen's primary `content`
 * beside a 300 to 320px `rail` of secondary panels. Measured on its own
 * container, like SplitPane; not a split pane (no list, no selection).
 *
 * At `lg` the two sit side by side with a `--border-subtle` hairline between,
 * as SplitPane separates its columns, and each scrolls on its own, so the rail
 * stays put while the content moves. Below `lg`, `railBelow` (the default)
 * stacks the rail panels after the content in one scrolling column; `false`
 * hides the rail, for a pane that cannot have anything under it (a chat thread
 * whose bottom edge is the composer). The rail panels take `pagePad` and the
 * section gap; the content's padding is the content's. Give it a height.
 */
export function ContentRail({ content, rail, railWidth = 300, railBelow = true, style, ...rest }) {
  const { ref, bp } = useMeasuredBreakpoint();
  const wide = bp === 'lg';
  const panels = (
    <aside aria-label="Related" style={{ padding: pagePad(bp), display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      {rail}
    </aside>
  );
  const column = { minWidth: 0, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' };
  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'stretch', minHeight: 0, height: '100%', ...style }} {...rest}>
      <div style={{ ...column, flex: 1 }}>
        {content}
        {!wide && railBelow && panels}
      </div>
      {wide && (
        <div style={{ ...column, flex: 'none', width: railWidth, borderLeft: '1px solid var(--border-subtle)' }}>
          {panels}
        </div>
      )}
    </div>
  );
}
