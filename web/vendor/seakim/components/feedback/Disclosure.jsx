import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';
import { useCoarsePointer } from '../core/useCoarsePointer.js';

/**
 * One collapsible section over native `<details>`/`<summary>`: the summary row,
 * an optional `meta` on its right ("1 of 1", "4 items"), a chevron that turns, and
 * the body below. Several stack; more than one may be open; nothing closes a
 * sibling. The references (Twenty, Attio, Salesforce, Revolut) agree on all of
 * that, and native `<details>` gives Enter/Space, find-in-page and the toggle
 * event for free.
 *
 * Controlled with `open` + `onToggle`, or uncontrolled with `defaultOpen`. The
 * summary is a flex row, which is what hides the browser's own marker. The row
 * takes a hover tint and the touch floor on coarse pointers (0023); the body is
 * not indented (the references never indent). No border, no fill (0037).
 */
export function Disclosure({ summary, meta, open, defaultOpen = false, onToggle, children, style, ...rest }) {
  const [internal, setInternal] = useState(defaultOpen);
  const [hover, setHover] = useState(false);
  const coarse = useCoarsePointer();
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internal;
  return (
    <details
      open={isOpen}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        if (!controlled) setInternal(next);
        if (onToggle) onToggle(next);
      }}
      style={{ ...style }}
      {...rest}
    >
      <summary
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          minHeight: coarse ? 44 : 'var(--control-h-md)',
          padding: '0 var(--space-3)',
          margin: '0 calc(-1 * var(--space-3))',
          borderRadius: 'var(--radius-lg)',
          cursor: 'pointer',
          userSelect: 'none',
          listStyle: 'none',
          font: 'var(--type-body)',
          color: 'var(--text-primary)',
          background: hover ? 'var(--surface-hover)' : 'transparent',
          transition: 'var(--transition-control)',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{summary}</span>
        {meta != null && (
          <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{meta}</span>
        )}
        <Icon
          name="caret-down"
          size={16}
          style={{
            color: 'var(--text-tertiary)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--dur-base) var(--ease-out)',
          }}
        />
      </summary>
      <div style={{ padding: 'var(--space-3) 0 var(--space-5)' }}>{children}</div>
    </details>
  );
}
