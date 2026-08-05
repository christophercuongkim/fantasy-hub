import React from 'react';

/** Label + hint + error scaffold. Every form control in the system sits in one. */
export function Field({ label, hint, error, required = false, htmlFor, children, style, ...rest }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0, ...style }} {...rest}>
      {label && (
        <label htmlFor={htmlFor} style={{
          font: 'var(--type-label)', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        }}>
          {label}
          {required && <span style={{ color: 'var(--text-danger)' }} aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {(error || hint) && (
        <div style={{
          font: 'var(--type-caption)',
          color: error ? 'var(--text-danger)' : 'var(--text-tertiary)',
        }}>{error || hint}</div>
      )}
    </div>
  );
}
