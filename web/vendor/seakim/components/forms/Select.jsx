import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';

const SIZES = {
  sm: { h: 'var(--control-h-sm)', fs: 'var(--text-xs)' },
  md: { h: 'var(--control-h-md)', fs: 'var(--text-sm)' },
  lg: { h: 'var(--control-h-lg)', fs: 'var(--text-md)' },
};

export function Select({ options = [], size = 'md', invalid = false, disabled = false, fullWidth = true, placeholder, style, ...rest }) {
  const [focus, setFocus] = useState(false);
  const [hover, setHover] = useState(false);
  const s = SIZES[size] || SIZES.md;
  const border = invalid ? 'var(--text-danger)' : focus ? 'var(--border-focus)' : hover && !disabled ? 'var(--border-strong)' : 'var(--border-default)';
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        width: fullWidth ? '100%' : undefined, height: s.h,
        background: disabled ? 'var(--fill-disabled)' : 'var(--surface-raised)',
        border: `1px solid ${disabled ? 'var(--border-disabled)' : border}`, borderRadius: 'var(--radius-none)',
        boxShadow: focus ? 'var(--focus-ring-inset)' : 'none',
         transition: 'var(--transition-control)', ...style,
      }}
    >
      <select
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        {...rest}
        style={{
          appearance: 'none', WebkitAppearance: 'none', width: '100%', height: '100%',
          border: 'none', outline: 'none', background: 'transparent',
          padding: '0 var(--space-8) 0 var(--space-4)',
          fontFamily: 'var(--font-sans)', fontSize: s.fs, color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>;
        })}
      </select>
      <Icon name="caret-down" size={14} style={{ position: 'absolute', right: 'var(--space-4)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
    </div>
  );
}
