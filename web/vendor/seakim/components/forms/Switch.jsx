import React, { useState } from 'react';

const SIZES = { sm: { w: 30, h: 18, k: 12 }, md: { w: 38, h: 22, k: 16 } };

/** Applies immediately. The track is one of the few pill shapes in the system. */
export function Switch({ checked, defaultChecked = false, onChange, label, hint, size = 'md', disabled = false, style, ...rest }) {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked != null ? checked : inner;
  const s = SIZES[size] || SIZES.md;
  const pad = (s.h - s.k) / 2;
  function toggle() {
    if (disabled) return;
    if (checked == null) setInner(!on);
    onChange && onChange(!on);
  }
  return (
    <label style={{
      display: 'flex', alignItems: hint ? 'flex-start' : 'center', gap: 'var(--space-4)',
      cursor: disabled ? 'not-allowed' : 'pointer', 
      justifyContent: label ? 'space-between' : 'flex-start', ...style,
    }} {...rest}>
      {(label || hint) && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {label && <span style={{ font: 'var(--type-body-sm)', color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)' }}>{label}</span>}
          {hint && <span style={{ font: 'var(--type-caption)', color: disabled ? 'var(--text-disabled)' : 'var(--text-tertiary)' }}>{hint}</span>}
        </span>
      )}
      <input type="checkbox" role="switch" checked={on} onChange={toggle} disabled={disabled}
             style={{ position: 'absolute', opacity: 0, width: s.w, height: s.h, margin: 0 }} />
      <span style={{
        width: s.w, height: s.h, flex: 'none', padding: pad, marginTop: hint ? 2 : 0,
        borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center',
        background: disabled ? 'var(--fill-disabled)' : on ? 'var(--fill-accent)' : 'var(--fill-neutral)',
        border: `1px solid ${disabled ? 'var(--border-disabled)' : on ? 'var(--fill-accent)' : 'var(--border-default)'}`,
        boxSizing: 'content-box', transition: 'var(--transition-surface)',
      }}>
        <span style={{
          width: s.k, height: s.k, borderRadius: 'var(--radius-circle)',
          background: disabled ? 'var(--text-disabled)' : on ? 'var(--on-accent)' : 'var(--text-secondary)',
          transform: `translateX(${on ? s.w - s.k : 0}px)`,
          transition: 'transform var(--dur-base) var(--ease-spring), background-color var(--dur-fast) var(--ease-out)',
        }} />
      </span>
    </label>
  );
}
