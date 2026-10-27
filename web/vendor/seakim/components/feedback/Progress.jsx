import React, { useId } from 'react';
import { trackStyle, fillStyle } from '../core/track.js';

/**
 * A determinate linear progress bar: a thin track, an accent fill, an optional
 * label after it ("4 of 13"). For a thing in motion towards a known end — a
 * wizard, an upload, a trial counter. For a measurement that is not going
 * anywhere, use `Meter`; for "something is loading and we do not know how
 * much", `Skeleton` or `LoadingState` (0021).
 *
 * The fill width transitions with `--dur-base` / `--ease-out` and nothing else
 * moves; reduced motion zeroes the duration through the token (§0.9). The track
 * and fill take `--radius-full`, the rung for toggle tracks and pills (§0.1).
 * `role="progressbar"` carries the value; the label, when given, names it
 * through `aria-labelledby`, otherwise pass `aria-label`.
 */
export function Progress({ value = 0, max = 100, label, size = 'sm', style, ...rest }) {
  const id = useId();
  const clamped = Math.min(Math.max(Number(value) || 0, 0), max);
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', ...style }} {...rest}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-labelledby={label != null ? id : undefined}
        style={{ flex: 1, ...trackStyle(size) }}
      >
        <div style={fillStyle(pct, { animate: true })} />
      </div>
      {label != null && (
        <span id={id} style={{ font: 'var(--type-caption)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {label}
        </span>
      )}
    </div>
  );
}
