import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { IconButton } from '../core/IconButton.jsx';

const TONES = {
  neutral: { icon: 'info', color: 'var(--text-secondary)' },
  success: { icon: 'check-circle', color: 'var(--text-success)' },
  warning: { icon: 'warning', color: 'var(--text-warning)' },
  danger:  { icon: 'x-circle', color: 'var(--text-danger)' },
};

/** Transient confirmation. Pops in with --ease-pop, fades out. Never blocks. */
export function Toast({ message, tone = 'neutral', action, actionLabel, onDismiss, style, ...rest }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
        minWidth: 280, maxWidth: 420, padding: 'var(--space-4) var(--space-4) var(--space-4) var(--space-5)',
        background: 'var(--surface-overlay)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-none)', boxShadow: 'var(--shadow-toast)',
        animation: 'sk-toast-in var(--dur-base) var(--ease-pop) both',
        ...style,
      }}
      {...rest}
    >
      <Icon name={t.icon} size={16} weight="fill" style={{ color: t.color }} />
      <span style={{ flex: 1, font: 'var(--type-body-sm)', color: 'var(--text-primary)' }}>{message}</span>
      {actionLabel && (
        <button type="button" onClick={action}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
            font: 'var(--type-label)', color: 'var(--text-accent)', whiteSpace: 'nowrap',
          }}>{actionLabel}</button>
      )}
      {onDismiss && <IconButton icon="x" label="Dismiss" size="sm" variant="ghost" onClick={onDismiss} />}
      <style>{'@keyframes sk-toast-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}'}</style>
    </div>
  );
}
