import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** The screen before there is anything on it. Says what goes here and how to start. */
export function EmptyState({ icon = 'tray', title, description, action, compact = false, style, ...rest }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      gap: 'var(--space-5)', padding: compact ? 'var(--space-8) var(--space-6)' : 'var(--space-11) var(--space-7)',
      border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-none)',
      background: 'var(--surface-sunken)', ...style,
    }} {...rest}>
      <Icon name={icon} size={compact ? 24 : 32} style={{ color: 'var(--text-tertiary)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
        {title && <div style={{ font: 'var(--type-subheading)', color: 'var(--text-primary)' }}>{title}</div>}
        {description && <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', maxWidth: '44ch' }}>{description}</p>}
      </div>
      {action}
    </div>
  );
}
