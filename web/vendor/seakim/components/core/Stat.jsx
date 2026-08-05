import React from 'react';
import { Icon } from './Icon.jsx';

const SIZES = {
  sm: { label: 'var(--text-2xs)', value: 'var(--text-lg)' },
  md: { label: 'var(--text-xs)', value: 'var(--text-2xl)' },
  lg: { label: 'var(--text-xs)', value: 'var(--text-4xl)' },
};

/** A label/value/delta unit. Values are mono and tabular so columns align. */
export function Stat({ label, value, unit, delta, deltaDirection, hint, size = 'md', align = 'left', style, ...rest }) {
  const s = SIZES[size] || SIZES.md;
  const dir = deltaDirection || (typeof delta === 'string' && delta.trim().startsWith('-') ? 'down' : delta ? 'up' : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: align === 'right' ? 'flex-end' : 'flex-start', ...style }} {...rest}>
      <div style={{
        font: 'var(--type-eyebrow)', fontSize: s.label, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', whiteSpace: 'nowrap',
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: s.value, fontWeight: 'var(--weight-medium)',
          lineHeight: 1, letterSpacing: 'var(--tracking-tight)', color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}>{value}{unit && <span style={{ fontSize: '0.6em', color: 'var(--text-tertiary)', marginLeft: 2 }}>{unit}</span>}</span>
        {delta != null && delta !== '' && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)',
            color: dir === 'down' ? 'var(--text-danger)' : 'var(--text-success)', fontVariantNumeric: 'tabular-nums',
          }}>
            <Icon name={dir === 'down' ? 'arrow-down-right' : 'arrow-up-right'} size={11} weight="bold" />
            {String(delta).replace(/^-/, '')}
          </span>
        )}
      </div>
      {hint && <div style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>{hint}</div>}
    </div>
  );
}
