import React, { useState } from 'react';

function Dot({ on, hover, disabled }) {
  return (
    <span style={{
      width: 16, height: 16, flex: 'none', borderRadius: 'var(--radius-circle)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: disabled ? 'var(--fill-disabled)' : 'var(--surface-raised)',
      border: `${on ? 2 : 1}px solid ${disabled ? 'var(--border-disabled)' : on ? 'var(--fill-accent)' : hover ? 'var(--border-strong)' : 'var(--border-default)'}`,
      transition: 'var(--transition-control)',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: 'var(--radius-circle)',
        background: disabled ? 'var(--text-disabled)' : 'var(--fill-accent)',
        transform: on ? 'scale(1)' : 'scale(0)',
        transition: 'transform var(--dur-base) var(--ease-pop)',
      }} />
    </span>
  );
}

/** Radio group. Renders the whole set — a lone radio is always a mistake. */
export function Radio({ name, options = [], value, defaultValue, onChange, direction = 'column', disabled = false, style, ...rest }) {
  const [inner, setInner] = useState(defaultValue);
  const [hoverKey, setHoverKey] = useState(null);
  const current = value != null ? value : inner;
  return (
    <div role="radiogroup" style={{ display: 'flex', flexDirection: direction, gap: direction === 'row' ? 'var(--space-7)' : 'var(--space-4)', ...style }} {...rest}>
      {options.map(o => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        const on = current === opt.value;
        const off = disabled || opt.disabled;
        return (
          <label
            key={opt.value}
            onMouseEnter={() => setHoverKey(opt.value)}
            onMouseLeave={() => setHoverKey(null)}
            style={{
              display: 'flex', gap: 'var(--space-4)', alignItems: opt.hint ? 'flex-start' : 'center',
              cursor: off ? 'not-allowed' : 'pointer', 
            }}
          >
            <input type="radio" name={name} checked={on} disabled={off}
                   onChange={() => { if (value == null) setInner(opt.value); onChange && onChange(opt.value); }}
                   style={{ position: 'absolute', opacity: 0, width: 16, height: 16, margin: 0 }} />
            <span style={{ marginTop: opt.hint ? 2 : 0, display: 'inline-flex' }}>
              <Dot on={on} hover={hoverKey === opt.value} disabled={off} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: 'var(--type-body-sm)', color: off ? 'var(--text-disabled)' : 'var(--text-primary)' }}>{opt.label}</span>
              {opt.hint && <span style={{ font: 'var(--type-caption)', color: off ? 'var(--text-disabled)' : 'var(--text-tertiary)' }}>{opt.hint}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
