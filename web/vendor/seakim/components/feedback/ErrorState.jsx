import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';

/**
 * A region or route that failed (decision 0029). Says what broke, what it means,
 * and the one way forward — a retry, or a navigational escape when retrying
 * cannot help (a 403). The recovery action is the point.
 *
 * It reuses `EmptyState`'s centred frame — the same centring and title/description
 * rhythm — but takes none of its identity: **no dashed border** (that belongs to
 * empty alone), an **error-toned glyph**, and `role="alert"` + `aria-live=
 * "assertive"` so a user who just triggered the failure hears *that it failed*
 * without moving focus. Empty is static, loading is polite-busy (0021), error is
 * an assertive alert — the three must not read alike.
 *
 * Not a `Toast`: a failed page or region needs a persistent state to return to and
 * act on. Toast keeps a failed *incidental* action; `ErrorState` owns the region
 * or route failure.
 */
export function ErrorState({
  icon = 'warning',
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  action,
  compact = false,
  style,
  ...rest
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--space-5)',
        padding: compact
          ? 'var(--space-8) var(--space-6)'
          : 'var(--space-11) var(--space-7)',
        background: 'var(--surface-sunken)',
        ...style,
      }}
      {...rest}
    >
      <Icon
        name={icon}
        size={compact ? 24 : 32}
        weight="fill"
        style={{ color: 'var(--text-danger)' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
        {title && <div style={{ font: 'var(--type-subheading)', color: 'var(--text-primary)' }}>{title}</div>}
        {description && <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', maxWidth: '44ch' }}>{description}</p>}
      </div>
      {action ??
        (onRetry && (
          <Button variant="secondary" iconLeft="arrow-clockwise" onClick={onRetry}>
            {retryLabel}
          </Button>
        ))}
    </div>
  );
}
