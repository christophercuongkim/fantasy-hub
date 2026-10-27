import React, { createContext, useContext, useEffect, useRef } from 'react';
import { IconButton } from '../core/IconButton.jsx';
import { useMeasuredBreakpoint } from '../core/useMeasuredBreakpoint.js';

const Scope = createContext({ narrow: false, onBack: undefined });

/**
 * A list beside its detail, with an optional properties column: the shape of
 * every mail client, CRM and inbox the references showed (Notion Mail, Plain,
 * Lemni, Intercom, Glassdoor, Attio, Twenty). Layout only: it decides which
 * columns show at which width and lets each scroll on its own; the URL and
 * the selection are the app's.
 *
 * Measured on its own container: under `md` it shows the list, or the detail
 * when `detailOpen` (the phone push every reference uses); from `md` the list
 * and the detail; from `lg` the `aside` too. A `--border-subtle` hairline
 * separates columns, the one place 0037 allows an edge between panels. Put a
 * `SplitPane.Header` at the top of the detail: it shows a back control on the
 * phone and a close control otherwise, with prev/next and a counter.
 */
export function SplitPane({ list, detail, aside, detailOpen = false, onBack, listWidth = '24rem', asideWidth = '20rem', style, ...rest }) {
  const { ref, bp } = useMeasuredBreakpoint();
  const narrow = bp === 'sm';
  const showList = !narrow || !detailOpen;
  const showDetail = !narrow || detailOpen;
  const showAside = bp === 'lg' && aside != null;
  const hairline = '1px solid var(--border-subtle)';
  return (
    <Scope.Provider value={{ narrow, onBack }}>
      <div ref={ref} style={{ display: 'flex', alignItems: 'stretch', minHeight: 0, height: '100%', ...style }} {...rest}>
        {showList && (
          <div style={{ flex: narrow ? 1 : 'none', width: narrow ? '100%' : listWidth, minWidth: 0, overflow: 'auto', borderRight: !narrow && showDetail ? hairline : undefined }}>
            {list}
          </div>
        )}
        {showDetail && (
          <div data-sk-split-detail="" role="region" aria-label="Detail" style={{ flex: 1, minWidth: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {detail}
          </div>
        )}
        {showAside && (
          <div style={{ flex: 'none', width: asideWidth, minWidth: 0, overflow: 'auto', borderLeft: hairline }}>
            {aside}
          </div>
        )}
      </div>
    </Scope.Provider>
  );
}

/**
 * The detail column's own header: back on the phone or close otherwise, the
 * title, a counter ("3 of 12"), prev/next, and the pane's actions. Sticky to
 * the top of the scrolling detail. Escape anywhere in the detail calls
 * `onClose`, when given. Also exported as `SplitPaneHeader` so a Server
 * Component can render it (a client reference has no static properties).
 */
export function SplitPaneHeader({ title, counter, onClose, onPrev, onNext, actions, style, ...rest }) {
  const { narrow, onBack } = useContext(Scope);
  const ref = useRef(null);
  useEffect(() => {
    if (!onClose) return undefined;
    const region = ref.current && ref.current.closest('[data-sk-split-detail]');
    if (!region) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    region.addEventListener('keydown', onKey);
    return () => region.removeEventListener('keydown', onKey);
  }, [onClose]);
  const back = narrow && onBack;
  return (
    <div
      ref={ref}
      style={{
        position: 'sticky', top: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-5)',
        background: 'var(--surface-page)',
        borderBottom: '1px solid var(--border-subtle)',
        ...style,
      }}
      {...rest}
    >
      {back && <IconButton icon="arrow-left" label="Back" variant="ghost" size="sm" onClick={onBack} />}
      {!back && onClose && <IconButton icon="x" label="Close" variant="ghost" size="sm" onClick={onClose} />}
      <div style={{ flex: 1, minWidth: 0, font: 'var(--type-subheading)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
      {counter && <span style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{counter}</span>}
      {(onPrev || onNext) && (
        <span style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
          <IconButton icon="caret-up" label="Previous" variant="ghost" size="sm" onClick={onPrev} disabled={!onPrev} />
          <IconButton icon="caret-down" label="Next" variant="ghost" size="sm" onClick={onNext} disabled={!onNext} />
        </span>
      )}
      {actions}
    </div>
  );
}
// `SplitPane.Header` for client code; the named export is for Server Components,
// where a client reference does not expose static properties.
SplitPane.Header = SplitPaneHeader;
