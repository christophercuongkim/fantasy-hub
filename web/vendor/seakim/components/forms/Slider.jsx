import React, { useState, useRef, useCallback } from 'react';

/* Per spec/Slider.md and decision 0006.

   A fader, not a dial. The thumb is taller than the track and narrower than it is
   tall — that is what lets it read at 12px without a shadow, and a shadow would
   promise "floats above the page". A round thumb needs either a shadow or bulk. */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function snap(v, min, max, step) {
  if (!step) return clamp(v, min, max);
  const snapped = Math.round((v - min) / step) * step + min;
  // Re-round to kill float dust from the division.
  const decimals = (String(step).split('.')[1] || '').length;
  return clamp(Number(snapped.toFixed(decimals)), min, max);
}

const RAIL = {
  position: 'absolute', left: 0, right: 0, height: 4,
  background: 'var(--surface-inset)',
  border: '1px solid var(--border-subtle)',
  boxSizing: 'border-box',
};

function Thumb({ pct, focused, hovered, disabled, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        position: 'absolute', left: pct + '%', marginLeft: -6,
        width: 12, height: 20, boxSizing: 'border-box',
        background: disabled ? 'var(--fill-disabled)' : 'var(--fill-accent)',
        border: `1px solid ${
          disabled ? 'var(--border-disabled)'
            : focused || hovered ? 'var(--border-focus)' : 'var(--border-strong)'
        }`,
        transition: 'border-color var(--dur-instant) var(--ease-out)',
        // No growth on hover — nothing in the layout moves, because nothing in the
        // layout has depth.
      }}
    />
  );
}

export function Slider({
  min = 0, max = 100, step = 1,
  value, onChange,
  range = false,
  label, hint, format = v => String(v),
  ticks = false, disabled = false,
  style, ...rest
}) {
  const trackRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const dragIndex = useRef(-1);

  const values = range ? value : [value];
  const pct = v => ((v - min) / (max - min)) * 100;

  const valueFromEvent = useCallback(e => {
    const rect = trackRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    return snap(min + (x / rect.width) * (max - min), min, max, step);
  }, [min, max, step]);

  const emit = useCallback((next, i) => {
    if (!range) return onChange && onChange(next);
    const pair = [...values];
    pair[i] = next;
    // Thumbs may meet but never cross — pushing rather than swapping keeps the
    // grabbed thumb under the finger.
    if (i === 0) pair[0] = Math.min(pair[0], pair[1]);
    else pair[1] = Math.max(pair[1], pair[0]);
    onChange && onChange(pair);
  }, [range, values, onChange]);

  function nearestIndex(v) {
    if (!range) return 0;
    return Math.abs(v - values[0]) <= Math.abs(v - values[1]) ? 0 : 1;
  }

  function onPointerDown(e) {
    if (disabled) return;
    const v = valueFromEvent(e);
    const i = nearestIndex(v);
    dragIndex.current = i;
    setPressed(true);
    setFocusIndex(i);
    emit(v, i);

    const move = ev => {
      ev.preventDefault();
      emit(valueFromEvent(ev), dragIndex.current);
    };
    const up = () => {
      dragIndex.current = -1;
      setPressed(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function onKeyDown(e, i) {
    if (disabled) return;
    const span = max - min;
    const big = step ? Math.max(step, span / 10) : span / 10;
    const map = {
      ArrowLeft: -step || -span / 100, ArrowDown: -step || -span / 100,
      ArrowRight: step || span / 100, ArrowUp: step || span / 100,
      PageDown: -big, PageUp: big,
    };
    if (e.key === 'Home') { e.preventDefault(); return emit(min, i); }
    if (e.key === 'End') { e.preventDefault(); return emit(max, i); }
    if (map[e.key] == null) return;
    e.preventDefault();
    emit(snap(values[i] + map[e.key], min, max, step), i);
  }

  const display = range ? `${format(values[0])}–${format(values[1])}` : format(values[0]);
  const tickCount = ticks && step ? Math.round((max - min) / step) + 1 : 0;
  const showTicks = tickCount > 1 && tickCount < 12;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', ...style }} {...rest}>
      {(label || hint) && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)' }}>
          {label && (
            <span style={{ font: 'var(--type-label)', color: disabled ? 'var(--text-disabled)' : 'var(--text-secondary)', flex: 1 }}>
              {label}
            </span>
          )}
          {/* The value is always text, never a tooltip on the thumb: a tooltip is
              hidden by the finger on touch and animates a number the user is
              trying to read. */}
          <span style={{ font: 'var(--type-data)', color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)' }}>
            {display}
          </span>
        </div>
      )}

      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative', height: 'var(--control-h-touch)',
          display: 'flex', alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          touchAction: 'none',
          transform: pressed ? 'scale(var(--press-scale))' : 'scale(1)',
          transition: 'transform var(--dur-instant) var(--ease-out)',
        }}
      >
        <div style={RAIL} />
        <div style={{
          position: 'absolute', height: 4,
          left: range ? pct(values[0]) + '%' : 0,
          width: range ? (pct(values[1]) - pct(values[0])) + '%' : pct(values[0]) + '%',
          background: disabled ? 'var(--fill-disabled)' : 'var(--fill-accent)',
        }} />

        {showTicks && (
          <div style={{ position: 'absolute', left: 0, right: 0, height: 6, top: 'calc(50% + 6px)' }}>
            {Array.from({ length: tickCount }, (_, i) => (
              <span key={i} style={{
                position: 'absolute', left: (i / (tickCount - 1)) * 100 + '%',
                width: 1, height: 6, background: 'var(--border-default)',
              }} />
            ))}
          </div>
        )}

        {values.map((v, i) => (
          <Thumb
            key={i}
            pct={pct(v)}
            disabled={disabled}
            hovered={hovered}
            focused={focusIndex === i}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={range && i === 1 ? values[0] : min}
            aria-valuemax={range && i === 0 ? values[1] : max}
            aria-valuenow={v}
            aria-valuetext={format(v)}
            aria-label={range ? `${label || 'Value'} ${i === 0 ? 'minimum' : 'maximum'}` : label}
            aria-disabled={disabled || undefined}
            onKeyDown={e => onKeyDown(e, i)}
            onFocus={() => setFocusIndex(i)}
            onBlur={() => setFocusIndex(-1)}
          />
        ))}
      </div>

      {hint && (
        <span style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>{hint}</span>
      )}
    </div>
  );
}
