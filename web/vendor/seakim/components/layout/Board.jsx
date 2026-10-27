import React, { createContext, useContext, useId, useRef, useState } from 'react';
import { useMeasuredBreakpoint } from '../core/useMeasuredBreakpoint.js';
import { Tabs } from '../navigation/Tabs.jsx';

const Scope = createContext({ narrow: false, collapseEmpty: false });

/**
 * Kanban columns. Each `BoardColumn` has a header (label, count, an optional
 * status dot, a menu), its cards, and a footer for the add row; the column is
 * a sunken fill against the page, 22rem wide with a `--space-4` gap, which is
 * where ClickUp, Wrike, Asana, Programa, Slack and Trello all land. Cards are
 * the app's content, usually a `Card` with an eyebrow, a title and one chip.
 *
 * Empty columns collapse by default to a narrow vertical header that expands
 * on click (`collapseEmpty`, the job-search board pick; ClickUp has the same
 * toggle). Under `md`, measured on the container, the row becomes a
 * scroll-snap strip with one column at 85% and the next peeking, a `Tabs` row
 * of the stages with counts above it that jumps the strip, and page dots
 * under it: the pick's phone option, over Jira's and Asana's peek-and-swipe.
 */
export function Board({ children, collapseEmpty = true, columnWidth = '22rem', style, ...rest }) {
  const { ref, bp } = useMeasuredBreakpoint();
  const narrow = bp === 'sm';
  const [page, setPage] = useState(0);
  const strip = useRef(null);
  const columns = React.Children.toArray(children).filter(Boolean);
  const jump = (i) => {
    const el = strip.current;
    if (!el) return;
    el.scrollTo({ left: (el.scrollWidth / Math.max(columns.length, 1)) * i, behavior: 'smooth' });
  };
  return (
    <Scope.Provider value={{ narrow, collapseEmpty, columnWidth }}>
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0, ...style }} {...rest}>
        {narrow && columns.length > 1 && (
          <div style={{ overflowX: 'auto', padding: '0 var(--space-5)' }}>
            <Tabs
              size="sm"
              value={String(page)}
              onChange={(v) => jump(Number(v))}
              tabs={columns.map((c, i) => ({ value: String(i), label: c.props.label, count: c.props.count }))}
            />
          </div>
        )}
        <div
          ref={strip}
          onScroll={narrow ? (e) => {
            const el = e.currentTarget;
            const step = el.scrollWidth / Math.max(columns.length, 1);
            setPage(Math.round(el.scrollLeft / step));
          } : undefined}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)',
            flex: 1, minHeight: 0, maxHeight: '100%',
            overflowX: 'auto', overflowY: 'hidden',
            scrollSnapType: narrow ? 'x mandatory' : undefined,
            padding: narrow ? '0 var(--space-5)' : 0,
            scrollPaddingLeft: narrow ? 'var(--space-5)' : undefined,
          }}
        >
          {columns}
        </div>
        {narrow && columns.length > 1 && (
          <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)' }}>
            {columns.map((c, i) => (
              <span key={c.key ?? i} style={{ width: 6, height: 6, borderRadius: 'var(--radius-circle)', background: i === page ? 'var(--text-secondary)' : 'var(--border-strong)', transition: 'var(--transition-control)' }} />
            ))}
          </div>
        )}
      </div>
    </Scope.Provider>
  );
}

/** One column of a `Board`. */
export function BoardColumn({ label, count, tone, menu, footer, children, empty, style, ...rest }) {
  const { narrow, collapseEmpty, columnWidth } = useContext(Scope);
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const cards = React.Children.toArray(children).filter(Boolean);
  const isEmpty = empty != null ? empty : cards.length === 0;
  const collapsed = collapseEmpty && isEmpty && !narrow && !expanded;
  const dot = tone && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 'var(--radius-circle)', background: `var(--text-${tone})`, flex: 'none' }} />;

  if (collapsed) {
    return (
      <button
        type="button"
        aria-expanded="false"
        onClick={() => setExpanded(true)}
        style={{
          flex: 'none', width: 'var(--space-10)', minHeight: 'var(--space-12)', alignSelf: 'stretch',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)',
          padding: 'var(--space-4) 0', border: 0, cursor: 'pointer',
          background: 'var(--surface-sunken)', borderRadius: 'var(--radius-xl)', color: 'inherit', font: 'inherit',
          ...style,
        }}
        {...rest}
      >
        {dot}
        <span style={{ writingMode: 'vertical-rl', font: 'var(--type-eyebrow)', letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{label}</span>
        <span style={{ font: 'var(--type-caption)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{count ?? 0}</span>
      </button>
    );
  }

  return (
    <section
      aria-labelledby={id}
      style={{
        flex: narrow ? '0 0 85%' : `0 0 ${columnWidth}`, scrollSnapAlign: narrow ? 'start' : undefined,
        display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0, maxHeight: '100%', boxSizing: 'border-box',
        padding: 'var(--space-4)', borderRadius: 'var(--radius-xl)', background: 'var(--surface-sunken)',
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 'var(--control-h-sm)' }}>
        {dot}
        <h3 id={id} style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</h3>
        {count != null && <span style={{ font: 'var(--type-caption)', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
        <span style={{ flex: 1 }} />
        {menu}
      </div>
      <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minHeight: 0, overflowY: 'auto' }}>
        {cards.map((card, i) => <div role="listitem" key={card.key ?? i}>{card}</div>)}
      </div>
      {footer}
    </section>
  );
}
