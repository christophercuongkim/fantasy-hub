import React, { useState } from 'react';
import { useCoarsePointer } from '../core/useCoarsePointer.js';

/**
 * One row of a list: `leading` (an avatar, a logo, a checkbox, an icon),
 * `eyebrow`, `title`, `meta` stacked in the middle, `trailing` on the right (a
 * value, a time, a chevron, a kebab, a toggle). The same box serves a one-line
 * settings row and a three-line inbox row; the height comes from what is in it,
 * never from a density prop. The references show exactly those two families and
 * nothing between.
 *
 * `href` renders a link, `onClick` a button, neither a plain block. `selected`
 * is a fill (0037), not a bar, and sets `aria-current`. A row is square-cornered
 * and carries no hairline of its own; `ListGroup` draws the dividers between rows
 * so a lone row and a grouped row look the same.
 */
export function ListRow({ leading, eyebrow, title, meta, trailing, selected = false, href, onClick, disabled = false, style, ...rest }) {
  const [hover, setHover] = useState(false);
  const coarse = useCoarsePointer();
  const interactive = !disabled && (!!href || !!onClick);
  const Tag = href ? 'a' : onClick ? 'button' : 'div';
  // Disabled is a token, not a fade (§0.8, both themes); the text goes --text-disabled.
  const ink = disabled ? 'var(--text-disabled)' : 'var(--text-primary)';
  const inkSecondary = disabled ? 'var(--text-disabled)' : 'var(--text-secondary)';
  const base = {
    display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
    width: '100%', boxSizing: 'border-box', textAlign: 'left',
    minHeight: coarse ? 'var(--control-h-touch)' : 'var(--control-h-lg)',
    padding: 'var(--space-4) var(--space-5)',
    margin: 0, border: 0, borderRadius: 'var(--radius-none)',
    font: 'inherit', color: ink, textDecoration: 'none',
    background: selected ? 'var(--surface-selected)' : hover && interactive ? 'var(--surface-hover)' : 'transparent',
    cursor: interactive ? 'pointer' : disabled ? 'not-allowed' : 'default',
    transition: 'var(--transition-control)',
    appearance: 'none', WebkitAppearance: 'none',
    ...style,
  };
  const tagProps = href
    ? { href: disabled ? undefined : href, 'aria-disabled': disabled || undefined }
    : onClick
      ? { type: 'button', onClick, disabled }
      : {};
  return (
    <Tag
      {...tagProps}
      aria-current={selected ? 'true' : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={base}
      {...rest}
    >
      {leading != null && <span style={{ display: 'inline-flex', alignItems: 'center', flex: 'none', color: 'var(--text-secondary)' }}>{leading}</span>}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {eyebrow != null && <span style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{eyebrow}</span>}
        <span style={{ font: 'var(--type-body)', color: ink, overflowWrap: 'anywhere' }}>{title}</span>
        {meta != null && <span style={{ font: 'var(--type-body-sm)', color: inkSecondary, overflowWrap: 'anywhere' }}>{meta}</span>}
      </span>
      {trailing != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', flex: 'none', font: 'var(--type-body-sm)', color: inkSecondary, whiteSpace: 'nowrap' }}>{trailing}</span>}
    </Tag>
  );
}
