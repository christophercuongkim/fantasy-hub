import React from 'react';
import { Avatar } from './Avatar.jsx';

const SIZES = { xs: 20, sm: 24, md: 32, lg: 44, xl: 64 };

/** More than one avatar in one place: overlap them by a shared fraction of the
 *  diameter (`--avatar-overlap`), cap the count at `max`, and collapse the
 *  remainder into a "+k" count pill. The pill is a count, not a control (0024) —
 *  a caller that wants "see all" wraps the stack. When the remainder is exactly
 *  one, show the avatar rather than "+1": a pill that saves no space is noise.
 *  `frontToBack` picks which end sits on top; it defaults to first-in-front and
 *  is *not* a reading-order assumption. See decision 0024 and `spec/AvatarStack.md`. */
export function AvatarStack({ items = [], size = 'sm', max = 3, frontToBack = true, style, ...rest }) {
  const px = SIZES[size] || SIZES.sm;
  const fs = px <= 24 ? 'var(--text-2xs)' : px <= 32 ? 'var(--text-xs)' : px <= 44 ? 'var(--text-sm)' : 'var(--text-lg)';

  const n = items.length;
  const remainder = n - max;
  const overflow = remainder > 1;
  const shown = overflow ? items.slice(0, max) : items;
  const plus = overflow ? remainder : 0;
  const slots = shown.length + (plus > 0 ? 1 : 0);

  // A ring of --surface-card separates each mark from the one it overlaps. An
  // outline draws outside the box without changing the diameter (0037: never an
  // inset or spread shadow standing in for a border).
  const ring = 'var(--border-emphasis) solid var(--surface-card)';

  const label = plus > 0
    ? `${shown.length} people, and ${plus} more`
    : `${n} ${n === 1 ? 'person' : 'people'}`;

  const slot = (i, node, pill) => (
    <span
      key={i}
      style={{
        position: 'relative',
        marginLeft: i === 0 ? 0 : 'calc(var(--avatar-overlap) * -1)',
        // First-in-front means slot 0 paints on top; otherwise the last does.
        zIndex: frontToBack ? slots - i : i + 1,
        borderRadius: pill ? 'var(--radius-full)' : 'var(--radius-circle)',
        outline: ring,
        display: 'inline-flex',
      }}
    >
      {node}
    </span>
  );

  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: 'inline-flex', alignItems: 'center', ...style }}
      {...rest}
    >
      {shown.map((a, i) => slot(i, <Avatar name={a.name} src={a.src} size={size} status={a.status} />, false))}
      {plus > 0 && slot(shown.length, (
        <span
          aria-hidden="true"
          style={{
            height: px, minWidth: px, boxSizing: 'border-box',
            padding: '0 var(--space-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-full)',
            background: 'var(--surface-sunken)', color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)', fontSize: fs, fontWeight: 'var(--weight-medium)',
            fontVariantNumeric: 'tabular-nums', userSelect: 'none',
          }}
        >
          {`+${plus}`}
        </span>
      ), true)}
    </div>
  );
}
