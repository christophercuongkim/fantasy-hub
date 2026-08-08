import React from 'react';

const SIZES = {
  sm: { track: 5 },
  md: { track: 7 },
};

const pct = (v, lo, hi) => {
  if (hi <= lo) return 0;
  const p = ((v - lo) / (hi - lo)) * 100;
  return p < 0 ? 0 : p > 100 ? 100 : p;
};

/** A floor/mid/ceiling interval on a shared scale: an achromatic band from `low`
 *  to `high` with a marker at `mid`. Achromatic so a column of them stays calm —
 *  promote one with `accent`, and only on hover/focus: a selected row already
 *  spends accent on its leading border (0003), so promoting its band too would
 *  put two accents on one row. See decision 0017. */
export function Range({ low, mid, high, domain, size = 'md', accent = false, label, style, ...rest }) {
  const s = SIZES[size] || SIZES.md;
  const [d0, d1] = domain && domain.length === 2 ? domain : [0, high];
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  const bandL = pct(lo, d0, d1);
  const bandW = pct(hi, d0, d1) - bandL;
  return (
    <div
      role="img"
      aria-label={label != null ? label : `${lo} to ${hi}, ${mid}`}
      style={{ position: 'relative', width: '100%', height: s.track, ...style }}
      {...rest}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-none)' }} />
      {/* minWidth floors a near-zero-spread interval so the safe pick (tightest band)
          still reads as a band, not a smudge under the marker — see 0017 Consequences. */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${bandL}%`, width: `${bandW}%`, minWidth: 'var(--border-emphasis)', background: accent ? 'var(--fill-accent)' : 'var(--text-tertiary)' }} />
      <div style={{ position: 'absolute', top: -1, bottom: -1, left: `${pct(mid, d0, d1)}%`, width: 'var(--border-emphasis)', transform: 'translateX(-50%)', background: 'var(--text-primary)' }} />
    </div>
  );
}
