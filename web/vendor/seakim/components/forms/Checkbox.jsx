import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';

export function Checkbox({ checked, defaultChecked = false, indeterminate = false, label, hint, disabled = false, onChange, style, ...rest }) {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked != null ? checked : inner;
  const [hover, setHover] = useState(false);
  const marked = on || indeterminate;
  function toggle() {
    if (disabled) return;
    if (checked == null) setInner(!on);
    onChange && onChange(!on);
  }
  return (
    <label
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', gap: 'var(--space-4)', alignItems: hint ? 'flex-start' : 'center',
        cursor: disabled ? 'not-allowed' : 'pointer', ...style,
      }}
      {...rest}
    >
      <input type="checkbox" checked={on} onChange={toggle} disabled={disabled}
             style={{ position: 'absolute', opacity: 0, width: 16, height: 16, margin: 0 }} />
      <span style={{
        width: 16, height: 16, flex: 'none', marginTop: hint ? 2 : 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: disabled ? 'var(--fill-disabled)' : marked ? 'var(--fill-accent)' : 'var(--surface-raised)',
        border: `1px solid ${disabled ? 'var(--border-disabled)' : marked ? 'var(--fill-accent)' : hover ? 'var(--border-strong)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-none)',
        color: disabled ? 'var(--text-disabled)' : 'var(--on-accent)',
        transition: 'var(--transition-control)',
        transform: marked ? 'scale(1)' : 'scale(0.94)',
      }}>
        {indeterminate ? <Icon name="minus" size={11} weight="bold" /> : on ? <Icon name="check" size={11} weight="bold" /> : null}
      </span>
      {(label || hint) && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {label && <span style={{ font: 'var(--type-body-sm)', color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)' }}>{label}</span>}
          {hint && <span style={{ font: 'var(--type-caption)', color: disabled ? 'var(--text-disabled)' : 'var(--text-tertiary)' }}>{hint}</span>}
        </span>
      )}
    </label>
  );
}
