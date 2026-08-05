import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';

const SIZES = {
  sm: { h: 'var(--control-h-sm)', fs: 'var(--text-xs)', px: 'var(--space-4)', icon: 14 },
  md: { h: 'var(--control-h-md)', fs: 'var(--text-sm)', px: 'var(--space-4)', icon: 16 },
  lg: { h: 'var(--control-h-lg)', fs: 'var(--text-md)', px: 'var(--space-5)', icon: 18 },
};

export function Input({
  size = 'md', iconLeft, suffix, invalid = false, disabled = false, mono = false,
  fullWidth = true, style, ...rest
}) {
  const [focus, setFocus] = useState(false);
  const [hover, setHover] = useState(false);
  const s = SIZES[size] || SIZES.md;
  const border = invalid ? 'var(--text-danger)' : focus ? 'var(--border-focus)' : hover && !disabled ? 'var(--border-strong)' : 'var(--border-default)';
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        width: fullWidth ? '100%' : undefined, height: s.h, padding: `0 ${s.px}`,
        background: disabled ? 'var(--fill-disabled)' : 'var(--surface-raised)',
        border: `1px solid ${disabled ? 'var(--border-disabled)' : border}`,
        boxShadow: focus ? 'var(--focus-ring-inset)' : 'none',
        borderRadius: 'var(--radius-none)',
        
        transition: 'var(--transition-control), box-shadow var(--dur-instant) var(--ease-out)',
        ...style,
      }}
    >
      {iconLeft && <Icon name={iconLeft} size={s.icon} style={{ color: 'var(--text-tertiary)' }} />}
      <input
        disabled={disabled}
        onFocus={e => { setFocus(true); rest.onFocus && rest.onFocus(e); }}
        onBlur={e => { setFocus(false); rest.onBlur && rest.onBlur(e); }}
        {...rest}
        style={{
          flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          fontSize: s.fs, color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
          letterSpacing: mono ? '0.02em' : 'var(--tracking-normal)',
        }}
      />
      {suffix && <span style={{ font: 'var(--type-data)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{suffix}</span>}
    </div>
  );
}
