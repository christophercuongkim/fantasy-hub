import React, { useId } from 'react';
import { trackStyle, fillStyle } from '../core/track.js';

/**
 * A labelled measurement: the label above-left, the value above-right in
 * mono, a thin bar beneath. A fact about something, read at a glance and never
 * in motion; the one reference bar (Gumloop's credits) has exactly this shape.
 * `Progress` is for a thing moving towards an end and shares the track style.
 *
 * One accent fill, no thresholds: colour-coding a measurement red, amber or
 * green is a judgement the component should not make and the references never
 * do. `role="meter"` with the value and `aria-valuetext`, labelled by the label.
 */
export function Meter({ value = 0, max = 1, label, valueText, size = 'sm', style, ...rest }) {
  const id = useId();
  const clamped = Math.min(Math.max(Number(value) || 0, 0), max);
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  const text = valueText != null ? valueText : `${Math.round(pct)}%`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', ...style }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <span id={id} style={{ font: 'var(--type-body-sm)', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ font: 'var(--type-data)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{text}</span>
      </div>
      <div
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={text}
        aria-labelledby={id}
        style={trackStyle(size)}
      >
        <div style={fillStyle(pct)} />
      </div>
    </div>
  );
}
