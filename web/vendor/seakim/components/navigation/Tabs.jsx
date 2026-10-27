import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../core/Badge.jsx';
import { useCoarsePointer } from '../core/useCoarsePointer.js';

/**
 * Section switch within one screen. The indicator slides; nothing else moves.
 *
 * `fill` spans the row and its track across the container. The tabs share the
 * width when they fit at their natural widths (equally, when the widest one
 * allows it) and scroll at natural widths when they do not. Flex decides from
 * the container's own width (`flex: 1 0 0` with a `max-content` floor), so
 * there is no breakpoint and nothing to measure in script.
 *
 * In a scrolling row, a change of `value` (a tap, or a scroll-spy from
 * outside) scrolls the row the least distance that shows the active tab;
 * reduced motion jumps. Only `fill` rows scroll; without it the row is as
 * wide as its tabs, as before.
 */
export function Tabs({ tabs = [], value, defaultValue, onChange, size = 'md', fill = false, style, ...rest }) {
  const coarse = useCoarsePointer();
  const first = tabs[0] && (typeof tabs[0] === 'string' ? tabs[0] : tabs[0].value);
  const [inner, setInner] = useState(defaultValue != null ? defaultValue : first);
  const [hoverKey, setHoverKey] = useState(null);
  const current = value != null ? value : inner;
  const pad = size === 'sm' ? 'var(--space-4)' : 'var(--space-5)';
  const scroller = useRef(null);
  useEffect(() => {
    const row = scroller.current;
    const tab = row && row.querySelector('[aria-selected="true"]');
    if (!tab || row.scrollWidth <= row.clientWidth) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    const to = left < row.scrollLeft ? left
      : right > row.scrollLeft + row.clientWidth ? right - row.clientWidth
      : null;
    if (to == null) return;
    const still = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollTo({ left: to, behavior: still ? 'auto' : 'smooth' });
  }, [current]);
  const list = (
    <div role="tablist" ref={fill ? scroller : undefined} style={fill ? {
      // The scroller sits 1px over the track so the indicator lands on it, and
      // clips vertically so that overlap never becomes a scrollbar.
      position: 'relative', display: 'flex', alignItems: 'stretch',
      overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin', marginBottom: -1,
    } : {
      display: 'flex', alignItems: 'stretch', gap: 0,
      borderBottom: '1px solid var(--border-subtle)', ...style,
    }} {...(fill ? {} : rest)}>
      {tabs.map(t => {
        const tab = typeof t === 'string' ? { value: t, label: t } : t;
        const on = current === tab.value;
        return (
          <button
            key={tab.value} role="tab" aria-selected={on} type="button"
            onMouseEnter={() => setHoverKey(tab.value)}
            onMouseLeave={() => setHoverKey(null)}
            onClick={() => { if (value == null) setInner(tab.value); onChange && onChange(tab.value); }}
            style={{
              position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)',
              ...(fill ? { flex: '1 0 0', minWidth: 'max-content', justifyContent: 'center', whiteSpace: 'nowrap' } : null),
              minHeight: coarse ? 44 : undefined,
              padding: `${size === 'sm' ? '7px' : '10px'} ${pad}`,
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
              fontWeight: 'var(--weight-medium)',
              color: on ? 'var(--text-primary)' : hoverKey === tab.value ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'color var(--dur-instant) var(--ease-out)',
            }}
          >
            {tab.icon && <Icon name={tab.icon} size={size === 'sm' ? 14 : 16} weight={on ? 'fill' : 'regular'} />}
            {tab.label}
            {tab.count != null && <Badge tone={on ? 'accent' : 'neutral'}>{tab.count}</Badge>}
            <span style={{
              position: 'absolute', left: 0, right: 0, bottom: fill ? 0 : -1, height: 'var(--border-emphasis)',
              background: 'var(--fill-accent)',
              transform: on ? 'scaleX(1)' : 'scaleX(0)',
              transition: 'transform var(--dur-base) var(--ease-out)',
            }} />
          </button>
        );
      })}
    </div>
  );
  if (!fill) return list;
  // The track is the outer box, full width whether or not the row scrolls.
  return (
    <div style={{ width: '100%', borderBottom: '1px solid var(--border-subtle)', ...style }} {...rest}>
      {list}
    </div>
  );
}
