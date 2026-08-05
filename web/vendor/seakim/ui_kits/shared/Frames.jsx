import React, { useState, useEffect, useRef } from 'react';
import { SegmentedControl } from '../../components/forms/SegmentedControl.jsx';
import { IconButton } from '../../components/core/IconButton.jsx';
import { Tooltip } from '../../components/feedback/Tooltip.jsx';

/* ============================================================
   Responsive plumbing.

   Every SeaKim screen is ONE layout that reflows — there is no separate mobile
   build. Because the system styles inline rather than with stylesheets, screens
   cannot use CSS media queries, so they branch on a measured CONTAINER width
   instead. That is stricter than a media query: a screen embedded in a narrow
   panel reflows the same way it would on a phone.

   Breakpoints (see tokens/layout.css):
     sm  < 640    one column, tab bar, tappable rows, 44px targets
     md  640–1023 two columns where it helps, side nav collapses to icons
     lg  >= 1024  full chrome, dense tables, side rails
   ============================================================ */

export const BREAKPOINTS = { sm: 0, md: 640, lg: 1024 };

export function breakpointFor(width) {
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  return 'sm';
}

/** Measures its own element and reports {width, bp}. */
export function useMeasuredBreakpoint() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
 * The frame a kit renders into. `width` of 0 means "fill the window"; any other
 * value pins the viewport to that many px so a layout can be checked at a
 * specific size. The measured width is what screens branch on.
 */
export function Viewport({ width = 0, children }) {
  const { ref, width: measured, bp } = useMeasuredBreakpoint();
  const pinned = width > 0;
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center',
      background: pinned ? 'var(--surface-sunken)' : 'var(--surface-page)',
      padding: pinned ? 'var(--space-6)' : 0,
      overflow: 'hidden',
    }}>
      <div
        ref={ref}
        style={{
          width: pinned ? width : '100%',
          maxWidth: '100%',
          flex: pinned ? 'none' : 1,
          minWidth: 0,
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface-page)',
          border: pinned ? '1px solid var(--border-default)' : 'none',
          overflow: 'hidden',
        }}
      >
        {typeof children === 'function' ? children({ bp, width: measured }) : children}
      </div>
    </div>
  );
}

/** iOS status bar. Shown only when the viewport is phone-width. */
export function StatusBar({ time = '9:41' }) {
  return (
    <div style={{
      height: 44, flex: 'none', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 var(--space-6)',
      font: 'var(--type-data)', fontSize: 'var(--text-xs)', color: 'var(--text-primary)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <span>{time}</span>
      <span style={{ display: 'flex', gap: 'var(--space-3)', color: 'var(--text-secondary)' }}>
        <i className="ph-fill ph-cell-signal-full" /><i className="ph-fill ph-wifi-high" /><i className="ph-fill ph-battery-full" />
      </span>
    </div>
  );
}

/** Screen title block. Compact at sm, roomier from md up. */
export function ScreenHeader({ title, eyebrow, right, bp = 'lg' }) {
  return (
    <div style={{
      flex: 'none', display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)',
      padding: bp === 'sm' ? 'var(--space-4) var(--space-5) var(--space-5)' : 'var(--space-5) var(--space-6)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <div style={{
            font: 'var(--type-eyebrow)', textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)', color: 'var(--text-tertiary)',
            marginBottom: 'var(--space-2)',
          }}>{eyebrow}</div>
        )}
        <h1 style={{
          font: bp === 'sm' ? 'var(--type-heading)' : 'var(--type-subheading)',
          letterSpacing: 'var(--tracking-tight)',
        }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

const PRESETS = [
  { value: '0', label: 'Fill' },
  { value: '390', label: '390' },
  { value: '768', label: '768' },
  { value: '1280', label: '1280' },
];

/** Kit-viewer chrome, not product UI: pins the viewport width and flips theme. */
export function KitBar({ app, width, onWidth, theme, onTheme, bp, measured }) {
  return (
    <div style={{
      flex: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-5)',
      padding: 'var(--space-3) var(--space-5)',
      borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)',
    }}>
      <span style={{
        font: 'var(--type-eyebrow)', textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-caps)', color: 'var(--text-tertiary)',
        whiteSpace: 'nowrap',
      }}>{app}</span>

      <SegmentedControl
        size="sm"
        value={String(width)}
        onChange={v => onWidth(Number(v))}
        options={PRESETS}
      />

      <span style={{
        font: 'var(--type-data)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
        whiteSpace: 'nowrap',
      }}>
        {measured ? measured + 'px' : ''} <span style={{ color: 'var(--text-accent)' }}>{bp}</span>
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <span style={{
          font: 'var(--type-eyebrow)', textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-caps)', color: 'var(--text-tertiary)',
        }}>{theme}</span>
        <Tooltip label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'} side="left">
          <IconButton
            icon={theme === 'dark' ? 'sun' : 'moon'}
            label="Switch theme"
            size="sm"
            variant="secondary"
            onClick={onTheme}
          />
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * Responsive app chassis shared by both products: side nav from md up, bottom
 * tab bar at sm. Takes the same nav model either way, so a screen never knows
 * which one is showing.
 */
export function ResponsiveShell({
  bp, brand, nav = [], active, onNavigate, title, eyebrow, actions, tabs, children,
}) {
  const showSideNav = bp !== 'sm';
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {bp === 'sm' && <StatusBar />}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {showSideNav && children.sideNav}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {children.header}
          <main style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children.main}</main>
          {children.footer}
        </div>
      </div>
      {bp === 'sm' && children.tabBar}
    </div>
  );
}
