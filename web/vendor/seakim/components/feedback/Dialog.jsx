import React from 'react';
import { IconButton } from '../core/IconButton.jsx';

/** Modal. One of the few things that gets a shadow, because it floats. */
export function Dialog({ open = true, title, description, children, footer, onClose, width = 440, style, ...rest }) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal, 300)',
        background: 'var(--surface-scrim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-7)',
        animation: 'none',
      }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: width,
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-none)',
          boxShadow: 'var(--shadow-dialog)',
          display: 'flex', flexDirection: 'column', ...style,
        }}
        {...rest}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-5)',
          padding: 'var(--space-5) var(--space-5) 0',
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {title && <h2 style={{ font: 'var(--type-heading)', letterSpacing: 'var(--tracking-tight)' }}>{title}</h2>}
            {description && <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', maxWidth: '52ch' }}>{description}</p>}
          </div>
          {onClose && <IconButton icon="x" label="Close" size="sm" variant="ghost" onClick={onClose} />}
        </div>
        {children && <div style={{ padding: 'var(--space-5)' }}>{children}</div>}
        {footer && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-4)',
            padding: 'var(--space-5)', borderTop: '1px solid var(--border-subtle)',
            marginTop: children ? 0 : 'var(--space-5)',
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
}
