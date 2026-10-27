/**
 * The one bar style Progress and Meter share: a pill track in the sunken
 * surface, a pill fill in the accent. `sm` is `--space-2` (4px), what a wizard
 * or a score row uses; `md` is `--space-3` (8px), for a bar that is the whole
 * row. Progress animates the fill width on `--dur-base`; Meter does not,
 * because a measurement does not slide.
 */
export const TRACK_SIZES = { sm: 'var(--space-2)', md: 'var(--space-3)' };

export function trackStyle(size) {
  return {
    height: TRACK_SIZES[size] || TRACK_SIZES.sm,
    borderRadius: 'var(--radius-full)',
    background: 'var(--surface-sunken)',
    overflow: 'hidden',
  };
}

export function fillStyle(pct, { animate = false } = {}) {
  return {
    width: `${pct}%`,
    height: '100%',
    borderRadius: 'var(--radius-full)',
    background: 'var(--fill-accent)',
    transition: animate ? 'width var(--dur-base) var(--ease-out)' : 'none',
  };
}
