import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../core/Badge.jsx';

/** Section switch within one screen. Indicator springs; nothing else moves. */
export function Tabs({ tabs = [], value, defaultValue, onChange, size = 'md', style, ...rest }) {
  const first = tabs[0] && (typeof tabs[0] === 'string' ? tabs[0] : tabs[0].value);
  const [inner, setInner] = useState(defaultValue != null ? defaultValue : first);
  const [hoverKey, setHoverKey] = useState(null);
  const current = value != null ? value : inner;
  const pad = size === 'sm' ? 'var(--space-4)' : 'var(--space-5)';
  return (
    <div role="tablist" style={{
      display: 'flex', alignItems: 'stretch', gap: 0,
      borderBottom: '1px solid var(--border-subtle)', ...style,
    }} {...rest}>
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
              padding: `${size === 'sm' ? '7px' : '10px'} ${pad}`,
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
              fontWeight: on ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              color: on ? 'var(--text-primary)' : hoverKey === tab.value ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'color var(--dur-instant) var(--ease-out)',
            }}
          >
            {tab.icon && <Icon name={tab.icon} size={size === 'sm' ? 14 : 16} weight={on ? 'fill' : 'regular'} />}
            {tab.label}
            {tab.count != null && <Badge tone={on ? 'accent' : 'neutral'}>{tab.count}</Badge>}
            <span style={{
              position: 'absolute', left: 0, right: 0, bottom: -1, height: 2,
              background: 'var(--fill-accent)',
              transform: on ? 'scaleX(1)' : 'scaleX(0)',
              transition: 'transform var(--dur-base) var(--ease-spring)',
            }} />
          </button>
        );
      })}
    </div>
  );
}
