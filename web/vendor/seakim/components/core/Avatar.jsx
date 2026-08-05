import React from 'react';

const SIZES = { xs: 20, sm: 24, md: 32, lg: 44, xl: 64 };

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

/** Round by exception — avatars are one of the few circular shapes in the system. */
export function Avatar({ name = '', src, size = 'md', status, style, ...rest }) {
  const px = SIZES[size] || SIZES.md;
  const fs = px <= 24 ? 'var(--text-2xs)' : px <= 32 ? 'var(--text-xs)' : px <= 44 ? 'var(--text-sm)' : 'var(--text-lg)';
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flex: 'none' }} {...rest}>
      <span
        title={name || undefined}
        style={{
          width: px, height: px, borderRadius: 'var(--radius-circle)', overflow: 'hidden',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: src ? 'var(--surface-inset)' : 'var(--fill-neutral)',
          color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
          fontSize: fs, fontWeight: 'var(--weight-semibold)', letterSpacing: '0.01em',
          boxShadow: 'inset 0 0 0 1px var(--border-subtle)', userSelect: 'none', ...style,
        }}
      >
        {src
          ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : initials(name)}
      </span>
      {status && (
        <span
          style={{
            position: 'absolute', right: -1, bottom: -1,
            width: Math.max(6, Math.round(px * 0.28)), height: Math.max(6, Math.round(px * 0.28)),
            borderRadius: 'var(--radius-circle)',
            background: status === 'live' ? 'var(--text-success)' : status === 'out' ? 'var(--text-danger)' : 'var(--text-tertiary)',
            boxShadow: '0 0 0 2px var(--surface-card)',
          }}
        />
      )}
    </span>
  );
}
