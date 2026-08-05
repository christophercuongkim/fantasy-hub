import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Mobile bottom navigation. 3–5 destinations, 44px minimum targets. */
export function TabBar({ items = [], active, onChange, style, ...rest }) {
  return (
    <nav style={{
      display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '1fr',
      height: 'var(--tabbar-h, 56px)', flex: 'none',
      background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)', ...style,
    }} {...rest}>
      {items.map(item => {
        const on = active === (item.value || item.label);
        return (
          <button
            key={item.value || item.label} type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => onChange && onChange(item.value || item.label)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, minHeight: 'var(--control-h-touch, 44px)', border: 'none', background: 'transparent',
              cursor: 'pointer', color: on ? 'var(--text-accent)' : 'var(--text-tertiary)',
              transition: 'color var(--dur-fast) var(--ease-out)',
            }}
          >
            <span style={{
              display: 'inline-flex',
              transform: on ? 'translateY(-1px) scale(1.04)' : 'none',
              transition: 'transform var(--dur-base) var(--ease-spring)',
            }}>
              <Icon name={item.icon} size={22} weight={on ? 'fill' : 'regular'} />
            </span>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)',
              fontWeight: on ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              letterSpacing: '0.01em',
            }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
