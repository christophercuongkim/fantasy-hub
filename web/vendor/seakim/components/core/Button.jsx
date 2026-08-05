import React, { useState } from 'react';
import { Icon } from './Icon.jsx';

const SIZES = {
  sm: { h: 'var(--control-h-sm)', px: 'var(--space-4)', fs: 'var(--text-xs)', icon: 14, gap: 'var(--space-2)' },
  md: { h: 'var(--control-h-md)', px: 'var(--space-5)', fs: 'var(--text-sm)', icon: 16, gap: 'var(--space-3)' },
  lg: { h: 'var(--control-h-lg)', px: 'var(--space-6)', fs: 'var(--text-md)', icon: 20, gap: 'var(--space-3)' },
};

function palette(variant, hover, active, off) {
  // Disabled is its own palette rather than an opacity pass over the enabled one.
  // See tokens/colors.css and decision 0005.
  if (off) {
    return {
      background: variant === 'ghost' ? 'transparent' : 'var(--fill-disabled)',
      color: 'var(--text-disabled)',
      border: `1px solid ${variant === 'secondary' ? 'var(--border-disabled)' : 'transparent'}`,
    };
  }
  switch (variant) {
    case 'secondary':
      return { background: active ? 'var(--surface-active)' : hover ? 'var(--surface-hover)' : 'transparent',
               color: 'var(--text-primary)',
               border: `1px solid ${hover || active ? 'var(--border-strong)' : 'var(--border-default)'}` };
    case 'ghost':
      return { background: active ? 'var(--surface-active)' : hover ? 'var(--surface-hover)' : 'transparent',
               color: 'var(--text-secondary)', border: '1px solid transparent' };
    case 'danger':
      return { background: active ? 'var(--danger-500)' : hover ? 'var(--danger-400)' : 'var(--fill-danger)',
               color: 'var(--on-danger)', border: '1px solid transparent' };
    default:
      return { background: active ? 'var(--fill-accent-active)' : hover ? 'var(--fill-accent-hover)' : 'var(--fill-accent)',
               color: 'var(--on-accent)', border: '1px solid transparent' };
  }
}

export function Button({
  children, variant = 'primary', size = 'md', iconLeft, iconRight,
  loading = false, loadingLabel = 'Working…', disabled = false, fullWidth = false,
  type = 'button', style, onClick, ...rest
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const s = SIZES[size] || SIZES.md;
  const off = disabled || loading;
  return (
    <button
      type={type}
      disabled={off}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex', width: fullWidth ? '100%' : undefined,
        alignItems: 'center', justifyContent: 'center', gap: s.gap,
        height: s.h, padding: `0 ${s.px}`, borderRadius: 'var(--radius-none)',
        fontFamily: 'var(--font-sans)', fontSize: s.fs, fontWeight: 'var(--weight-semibold)',
        letterSpacing: '0.005em', whiteSpace: 'nowrap', cursor: off ? 'not-allowed' : 'pointer',
        transition: 'var(--transition-control)',
        transform: active && !off ? 'scale(var(--press-scale))' : 'scale(1)',
        ...palette(variant, hover && !off, active && !off, off), ...style,
      }}
      {...rest}
    >
      {loading
        ? <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-medium)' }}>{loadingLabel}</span>
        : <>
            {iconLeft && <Icon name={iconLeft} size={s.icon} />}
            {children}
            {iconRight && <Icon name={iconRight} size={s.icon} />}
          </>}
    </button>
  );
}
