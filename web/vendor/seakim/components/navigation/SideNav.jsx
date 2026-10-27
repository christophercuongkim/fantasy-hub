import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';
import { useCoarsePointer } from '../core/useCoarsePointer.js';

function Item({ item, active, collapsed }) {
  const [hover, setHover] = useState(false);
  const coarse = useCoarsePointer();
  return (
    <a
      href={item.href || '#'}
      onClick={item.onClick}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
        height: 34, minHeight: coarse ? 44 : undefined, padding: collapsed ? 0 : '0 var(--space-4)',
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: active ? 'var(--text-accent)' : hover ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--surface-selected)' : hover ? 'var(--surface-hover)' : 'transparent',
        // The active edge is a border, not an inset shadow (0037); always present so nothing shifts.
        borderLeft: `var(--border-emphasis) solid ${active ? 'var(--fill-accent)' : 'transparent'}`,
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-medium)',
        textDecoration: 'none', transition: 'var(--transition-control)',
      }}
    >
      <Icon name={item.icon} size={18} weight={active ? 'fill' : 'regular'} />
      {!collapsed && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      {!collapsed && item.trailing}
    </a>
  );
}

/**
 * Persistent left navigation for web app surfaces. `brand` is the wordmark; `brandCollapsed`
 * is what the 56px rail shows instead (a mark, an initial). Without it a string brand
 * collapses to its first letter and an element brand collapses to nothing.
 */
export function SideNav({ brand, brandCollapsed, groups = [], active, collapsed = false, footer, style, ...rest }) {
  const mark = brandCollapsed ?? (typeof brand === 'string' ? brand[0] : null);
  return (
    <nav style={{
      width: collapsed ? 'var(--sidebar-w-collapsed, 56px)' : 'var(--sidebar-w, 232px)',
      flex: 'none', height: '100%', display: 'flex', flexDirection: 'column',
      // A rail is a fill, not an outlined box (0037): no right border, header and footer separate by gap.
      background: 'var(--surface-card)',
      transition: 'width var(--dur-slow) var(--ease-out)', ...style,
    }} {...rest}>
      {(collapsed ? mark : brand) && (
        <div style={{
          height: 'var(--topbar-h, 52px)', flex: 'none', display: 'flex', alignItems: 'center',
          padding: collapsed ? 0 : '0 var(--space-5)', justifyContent: collapsed ? 'center' : 'flex-start',
          fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)',
          fontWeight: 'var(--weight-medium)', letterSpacing: 'var(--tracking-tight)',
          color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden',
        }}>{collapsed ? mark : brand}</div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {groups.map((g, gi) => (
          <div key={g.label || gi} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {g.label && !collapsed && (
              <div style={{
                font: 'var(--type-eyebrow)', color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
                padding: '0 var(--space-4) var(--space-3)',
              }}>{g.label}</div>
            )}
            {(g.items || []).map(item => (
              <Item key={item.value || item.label} item={item} active={active === (item.value || item.label)} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </div>
      {footer && <div style={{ flex: 'none', padding: 'var(--space-4)' }}>{footer}</div>}
    </nav>
  );
}
