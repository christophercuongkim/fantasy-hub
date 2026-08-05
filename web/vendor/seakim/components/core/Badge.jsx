import React from 'react';
import { Icon } from './Icon.jsx';

const TONES = {
  neutral: { subtle: ['var(--fill-neutral)', 'var(--text-secondary)'], solid: ['var(--fill-neutral-active)', 'var(--text-primary)'] },
  accent:  { subtle: ['var(--surface-selected)', 'var(--text-accent)'], solid: ['var(--fill-accent)', 'var(--on-accent)'] },
  success: { subtle: ['var(--fill-success-subtle)', 'var(--text-success)'], solid: ['var(--success-500)', 'var(--on-success)'] },
  warning: { subtle: ['var(--fill-warning-subtle)', 'var(--text-warning)'], solid: ['var(--warning-500)', 'var(--on-warning)'] },
  danger:  { subtle: ['var(--fill-danger-subtle)', 'var(--text-danger)'], solid: ['var(--danger-500)', 'var(--on-danger)'] },
  info:    { subtle: ['var(--fill-info-subtle)', 'var(--text-info)'], solid: ['var(--info-500)', 'var(--on-info)'] },
};

export function Badge({ children, tone = 'neutral', variant = 'subtle', icon, dot = false, mono = false, style, ...rest }) {
  const [bg, fg] = (TONES[tone] || TONES.neutral)[variant] || TONES.neutral.subtle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
      height: 20, padding: '0 var(--space-3)', background: bg, color: fg,
      border: variant === 'subtle' ? '1px solid var(--border-subtle)' : '1px solid transparent',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-semibold)',
      letterSpacing: mono ? 'var(--tracking-wide)' : '0.01em', whiteSpace: 'nowrap', ...style,
    }} {...rest}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: 'var(--radius-full)', background: 'currentColor' }} />}
      {icon && <Icon name={icon} size={11} weight="bold" />}
      {children}
    </span>
  );
}
