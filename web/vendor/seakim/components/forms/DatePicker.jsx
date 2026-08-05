import React, { useState, useMemo, useRef, useEffect } from 'react';
import { IconButton } from '../core/IconButton.jsx';
import { Input } from './Input.jsx';

/* Per spec/DatePicker.md and decision 0004.

   Square cells with a 1px hairline gap, so a selected range renders as ONE
   CONTINUOUS BAR — no notches, nothing to reconcile at the joins. This is the rare
   case where the 0px rule produces a better object than the platform default.

   The grid is an affordance over a text input, never the only way in: a returning
   traveller who knows the date types it faster, and a keyboard or screen-reader
   user gets a real field instead of a grid to arrow through.

   There is no time picker — see the ADR. A time is a mono Input, or a Select when
   the choices are genuinely enumerable. */

const DOW = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseIso = s => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
};

const same = (a, b) => !!a && !!b && iso(a) === iso(b);
const between = (d, a, b) => !!a && !!b && d > (a < b ? a : b) && d < (a < b ? b : a);

/** Monday-first grid, six rows, including leading and trailing days. */
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function Cell({ date, inMonth, state, onPick, onHover, disabled, touch }) {
  const size = touch ? 'var(--control-h-touch)' : 'var(--control-h-lg)';
  const bg = state.endpoint ? 'var(--fill-accent)'
    : state.inRange ? 'var(--surface-selected)'
    : 'var(--surface-raised)';
  const fg = state.endpoint ? 'var(--on-accent)'
    : state.inRange ? 'var(--text-accent)'
    : inMonth ? 'var(--text-primary)' : 'var(--text-tertiary)';

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={date.toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })}
      aria-current={state.today ? 'date' : undefined}
      aria-pressed={state.endpoint || state.inRange || undefined}
      onClick={() => onPick(date)}
      onMouseEnter={() => onHover && onHover(date)}
      style={{
        width: size, height: size, padding: 0, border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: 'var(--type-data)', fontSize: 'var(--text-sm)',
        background: bg,
        color: disabled ? 'var(--text-disabled)' : fg,
        fontWeight: state.endpoint ? 'var(--weight-semibold)' : 'var(--weight-regular)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        // Today is an UNDERLINE. A fill means selected and a ring means focused —
        // both are taken, and a ring vanishes once the date sits inside a range.
        boxShadow: state.today ? 'inset 0 -2px 0 var(--border-accent)' : 'none',
        transition: 'var(--transition-control)',
      }}
    >
      {date.getDate()}
    </button>
  );
}

function Month({
  year, month, selection, hoverDate, onPick, onHover,
  isDisabled, touch, onShift, showNav,
}) {
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const today = new Date();
  const [a, b] = selection;
  // Preview the provisional span while the second endpoint is being chosen.
  const provisional = a && !b && hoverDate ? hoverDate : b;
  const cellSize = touch ? 'var(--control-h-touch)' : 'var(--control-h-lg)';

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
        padding: 'var(--space-4) var(--space-5)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {showNav && (
          <IconButton icon="caret-left" label="Previous month" size="sm" onClick={() => onShift(-1)} />
        )}
        <span style={{
          flex: 1, font: 'var(--type-subheading)',
          textAlign: showNav ? 'left' : 'center',
        }}>{MONTHS[month]} {year}</span>
        {showNav && (
          <IconButton icon="caret-right" label="Next month" size="sm" onClick={() => onShift(1)} />
        )}
      </div>

      <div
        role="grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(7, ${cellSize})`,
          gap: 1, background: 'var(--border-subtle)', padding: 1,
        }}
      >
        {DOW.map(d => (
          <div key={d} role="columnheader" style={{
            height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-overlay)',
            font: 'var(--type-eyebrow)', color: 'var(--text-tertiary)',
          }}>{d}</div>
        ))}
        {cells.map(d => (
          <Cell
            key={iso(d)}
            date={d}
            touch={touch}
            inMonth={d.getMonth() === month}
            disabled={isDisabled ? isDisabled(d) : false}
            onPick={onPick}
            onHover={onHover}
            state={{
              today: same(d, today),
              endpoint: same(d, a) || same(d, provisional),
              inRange: between(d, a, provisional),
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function DatePicker({
  value, onChange, range = false,
  label, hint, error, isDisabled,
  bp = 'lg', months, style,
}) {
  const monthCount = months || (range && bp === 'lg' ? 2 : 1);
  const selection = range ? (value || [null, null]) : [value || null, null];
  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState(null);
  const [text, setText] = useState('');
  const anchor = selection[0] || new Date();
  const [cursor, setCursor] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() });
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const display = range
    ? [selection[0] && iso(selection[0]), selection[1] && iso(selection[1])]
        .filter(Boolean).join(' – ')
    : selection[0] ? iso(selection[0]) : '';

  function pick(d) {
    if (!range) { onChange && onChange(d); setOpen(false); return; }
    const [a, b] = selection;
    if (!a || b) { onChange && onChange([d, null]); return; }
    // Picking before the start reorders rather than rejecting.
    onChange && onChange(d < a ? [d, a] : [a, d]);
    setHoverDate(null);
    setOpen(false);
  }

  function commitText(v) {
    setText(v);
    if (range) {
      const parts = v.split(/\s*[–-]\s*/).map(parseIso);
      if (parts.length === 2 && parts[0] && parts[1]) onChange && onChange(parts);
      return;
    }
    const d = parseIso(v);
    if (d) onChange && onChange(d);
  }

  const grid = (
    <div style={{ display: 'flex' }}>
      {Array.from({ length: monthCount }, (_, i) => {
        const m = (cursor.m + i) % 12;
        const y = cursor.y + Math.floor((cursor.m + i) / 12);
        return (
          <div key={i} style={{ borderLeft: i ? '1px solid var(--border-subtle)' : 'none' }}>
            <Month
              year={y}
              month={m}
              selection={selection}
              hoverDate={hoverDate}
              onPick={pick}
              onHover={range ? setHoverDate : undefined}
              isDisabled={isDisabled}
              touch={bp === 'sm'}
              showNav={i === 0}
              onShift={delta => setCursor(c => {
                const next = new Date(c.y, c.m + delta, 1);
                return { y: next.getFullYear(), m: next.getMonth() };
              })}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {label && (
          <span style={{ font: 'var(--type-label)', color: 'var(--text-secondary)' }}>{label}</span>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Input
            mono
            invalid={!!error}
            value={text || display}
            placeholder={range ? '2026-03-14 – 2026-03-21' : '2026-03-14'}
            onChange={e => commitText(e.target.value)}
            onFocus={() => setText('')}
          />
          <IconButton
            icon="calendar-blank"
            label="Choose date"
            variant="secondary"
            active={open}
            onClick={() => setOpen(o => !o)}
          />
        </div>
        {(error || hint) && (
          <span style={{
            font: 'var(--type-caption)',
            color: error ? 'var(--text-danger)' : 'var(--text-tertiary)',
          }}>{error || hint}</span>
        )}
      </div>

      {open && (
        bp === 'sm'
          // At sm the overlay changes species — bottom sheet, per the overlay rule.
          ? <div
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 300,
                background: 'var(--surface-scrim)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%', background: 'var(--surface-overlay)',
                  borderTop: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-sheet)',
                  animation: 'sk-cal-up var(--dur-slow) var(--ease-out) both',
                }}
              >
                {grid}
                <style>{'@keyframes sk-cal-up{from{transform:translateY(100%)}to{transform:none}}'}</style>
              </div>
            </div>
          : <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
              background: 'var(--surface-overlay)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-popover)',
              animation: 'sk-cal-in var(--dur-base) var(--ease-out) both',
            }}>
              {grid}
              <style>{'@keyframes sk-cal-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'}</style>
            </div>
      )}
    </div>
  );
}
