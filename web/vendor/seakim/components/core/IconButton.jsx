import React, { useState } from 'react';
import { Icon } from './Icon.jsx';
import { useCoarsePointer } from './useCoarsePointer.js';

const SIZES = { sm: { box: 28, icon: 14 }, md: { box: 34, icon: 16 }, lg: { box: 44, icon: 20 } };

export function IconButton({ icon, label, variant = 'ghost', size = 'md', active = false, disabled = false, style, ...rest }) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const coarse = useCoarsePointer();
  const s = SIZES[size] || SIZES.md;
  const bordered = variant === 'secondary';
  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)} onMouseUp={() => setPress(false)}
      style={{
        width: s.box, height: s.box, minWidth: coarse ? 44 : undefined, minHeight: coarse ? 44 : undefined,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-lg)', cursor: disabled ? 'not-allowed' : 'pointer',
        border: bordered
          ? `1px solid ${disabled ? 'var(--border-disabled)' : hover ? 'var(--border-strong)' : 'var(--border-default)'}`
          : '1px solid transparent',
        background: disabled ? 'transparent'
          : active ? 'var(--surface-selected)' : press ? 'var(--surface-active)' : hover ? 'var(--surface-hover)' : 'transparent',
        color: disabled ? 'var(--text-disabled)'
          : active ? 'var(--text-accent)' : hover ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'var(--transition-control)',
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={s.icon} weight={active ? 'fill' : 'regular'} />
    </button>
  );
}
