import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';

const SIZES = { sm: 'var(--control-h-sm)', md: 'var(--control-h-md)', lg: 'var(--control-h-lg)' };

/** 2–4 short, exclusive options, all visible. Selection is an accent-wash fill. */
export function SegmentedControl({ options = [], value, defaultValue, onChange, size = 'md', fullWidth = false, style, ...rest }) {
  const first = typeof options[0] === 'string' ? options[0] : options[0] && options[0].value;
  const [inner, setInner] = useState(defaultValue != null ? defaultValue : first);
  const current = value != null ? value : inner;
  return (
    <div role="tablist" style={{
      display: fullWidth ? 'grid' : 'inline-grid',
      gridAutoFlow: 'column', gridAutoColumns: fullWidth ? '1fr' : 'auto',
      height: SIZES[size] || SIZES.md,
      border: '1px solid var(--border-default)', borderRadius: 'var(--radius-none)',
      background: 'var(--surface-raised)', ...style,
    }} {...rest}>
      {options.map((o, i) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        const on = current === opt.value;
        return (
          <button
            key={opt.value} role="tab" aria-selected={on} type="button"
            onClick={() => { if (value == null) setInner(opt.value); onChange && onChange(opt.value); }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)',
              padding: `0 ${size === 'sm' ? 'var(--space-4)' : 'var(--space-5)'}`,
              border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--border-subtle)',
              background: on ? 'var(--surface-selected)' : 'transparent',
              color: on ? 'var(--text-accent)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
              fontWeight: on ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'var(--transition-control)',
            }}
          >
            {opt.icon && <Icon name={opt.icon} size={size === 'sm' ? 13 : 15} weight={on ? 'fill' : 'regular'} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
