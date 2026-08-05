import React, { useState } from 'react';
import { Icon } from './Icon.jsx';

const SIZES = { sm: { box: 28, icon: 14 }, md: { box: 34, icon: 16 }, lg: { box: 44, icon: 20 } };

export function IconButton({ icon, label, variant = 'ghost', size = 'md', active = false, disabled = false, style, ...rest }) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const s = SIZES[size] || SIZES.md;
  const bordered = variant === 'secondary';
  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)} onMouseUp={() => setPress(false)}
      style={{
        width: s.box, height: s.box, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-none)', cursor: disabled ? 'not-allowed' : 'pointer',
        border: bordered
          ? `1px solid ${disabled ? 'var(--border-disabled)' : hover ? 'var(--border-strong)' : 'var(--border-default)'}`
          : '1px solid transparent',
        background: disabled ? 'transparent'
          : active ? 'var(--surface-selected)' : press ? 'var(--surface-active)' : hover ? 'var(--surface-hover)' : 'transparent',
        color: disabled ? 'var(--text-disabled)'
          : active ? 'var(--text-accent)' : hover ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'var(--transition-control)', transform: press && !disabled ? 'scale(var(--press-scale))' : 'scale(1)',
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={s.icon} weight={active ? 'fill' : 'regular'} />
    </button>
  );
}
