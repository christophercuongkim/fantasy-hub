import React, { useState } from 'react';

export function Card({ children, eyebrow, title, meta, footer, media, interactive = false, selected = false, padding = 'var(--space-6)', onClick, style, ...rest }) {
  const [hover, setHover] = useState(false);
  const lift = interactive && hover;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column',
        background: selected ? 'var(--surface-selected)' : lift ? 'var(--surface-hover)' : 'var(--surface-card)',
        border: `1px solid ${selected ? 'var(--border-accent)' : lift ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-none)', cursor: interactive ? 'pointer' : undefined,
        transition: 'background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      {media}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', padding }}>
        {(eyebrow || title || meta) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {eyebrow && <span style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--tracking-caps)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{eyebrow}</span>}
            {title && <span style={{ font: 'var(--type-heading)', color: 'var(--text-primary)' }}>{title}</span>}
            {meta && <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>{meta}</span>}
          </div>
        )}
        {children}
      </div>
      {footer && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: `var(--space-5) ${padding}`, display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}
