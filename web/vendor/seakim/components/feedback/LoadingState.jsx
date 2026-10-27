import React from 'react';

/**
 * Loading when you know only that something is arriving — a route boot, a gate
 * (decision 0021). It names the thing being fetched and announces itself busy.
 *
 * It reuses `EmptyState`'s centred frame — the same centring and title/description
 * rhythm — but deliberately NOT the dashed border and NOT as an `EmptyState`
 * variant: empty means "nothing here, do something", loading means "something is
 * coming, wait", and they must not read alike. The indicator is a static linear
 * bar, never a spinner — SeaKim has none. `role="status"` + `aria-busy` make it
 * announce busy, then completion when it is replaced by content.
 */
export function LoadingState({ title, description, compact = false, style, ...rest }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--space-5)',
        padding: compact ? 'var(--space-8) var(--space-6)' : 'var(--space-11) var(--space-7)',
        background: 'var(--surface-sunken)',
        ...style,
      }}
      {...rest}
    >
      <div
        aria-hidden="true"
        style={{
          width: 'var(--space-10)',
          height: 'var(--space-1)',
          borderRadius: 'var(--radius-none)',
          background: 'var(--surface-shimmer)',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
        {title && <div style={{ font: 'var(--type-subheading)', color: 'var(--text-primary)' }}>{title}</div>}
        {description && <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', maxWidth: '44ch' }}>{description}</p>}
      </div>
    </div>
  );
}
