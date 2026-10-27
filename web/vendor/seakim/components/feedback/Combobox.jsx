import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../core/Icon.jsx';
import { useCoarsePointer } from '../core/useCoarsePointer.js';
import { skMatchScore, skFuzzyScore } from '../core/match.js';

/**
 * Searchable long-list picker (decision 0028). A fully custom `role="combobox"`
 * widget — NOT a native <select>, which cannot filter. A field trigger styled
 * exactly like `Select`'s closed box (hairline border, the caret, and the inset
 * focus ring the hand-rolled version kept dropping) opens an anchored overlay: a
 * filter input pinned above a scrollable, keyboard-navigable, RANKED listbox.
 *
 * Ranking is part of the contract, not the caller's choice: options are scored by
 * the shared matcher (substring-tiered by default, fuzzy opt-in), sorted by score
 * descending, score-0 misses dropped, original order kept within a tier. The empty
 * result NAMES the filter and offers to clear it, never a bare empty box.
 */

const SIZES = {
  sm: { h: 'var(--control-h-sm)', fs: 'var(--text-xs)' },
  md: { h: 'var(--control-h-md)', fs: 'var(--text-sm)' },
  lg: { h: 'var(--control-h-lg)', fs: 'var(--text-md)' },
};

const norm = (o) => (typeof o === 'string' ? { value: o, label: o } : o);

export function Combobox({
  options = [], value, onChanged, placeholder = 'Select…', label,
  size = 'md', invalid = false, disabled = false, fuzzy = false, style, ...rest
}) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [hover, setHover] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const coarse = useCoarsePointer();
  const s = SIZES[size] || SIZES.md;
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (i) => `${uid}-opt-${i}`;

  const all = useMemo(() => options.map(norm), [options]);
  const selected = all.find((o) => o.value === value);

  // Rank: score every option, drop misses, sort by score desc with the original
  // index as a stable tiebreaker (keep list order within a tier). This IS the 0028
  // contract — not left to the caller — so a picker ranks the same in every app.
  const results = useMemo(() => {
    const score = fuzzy ? skFuzzyScore : skMatchScore;
    return all
      .map((o, i) => ({ o, i, sc: score(query, o.label) }))
      .filter((r) => r.sc > 0)
      .sort((a, b) => (b.sc - a.sc) || (a.i - b.i))
      .map((r) => r.o);
  }, [all, query, fuzzy]);

  // Keep the active row in range as the filtered set shrinks/grows.
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (active > results.length - 1) setActive(Math.max(0, results.length - 1));
  }, [results.length, active]);

  // Focus moves INTO the filter input on open, and back to the trigger on close.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (focus) triggerRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Outside-press closes (0022). Guard typeof window for SSR; the effect body only
  // runs client-side, but the mount is symmetric across environments.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    function onDocPointer(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    }
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }

  // Move the active option, wrapping, skipping disabled rows.
  function move(delta) {
    const n = results.length;
    if (!n) return;
    let i = active;
    for (let step = 0; step < n; step++) {
      i = (i + delta + n) % n;
      if (!results[i].disabled) { setActive(i); return; }
    }
  }

  function pick(opt) {
    if (!opt || opt.disabled) return;
    onChanged?.(opt.value);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }

  function onInputKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  const border = invalid
    ? 'var(--text-danger)'
    : (focus || open) ? 'var(--border-focus)'
    : hover && !disabled ? 'var(--border-strong)' : 'var(--border-default)';

  return (
    <div
      ref={rootRef}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0, ...style }}
      {...rest}
    >
      {label && (
        <span style={{ font: 'var(--type-label)', color: 'var(--text-secondary)' }}>{label}</span>
      )}

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', width: '100%',
          height: s.h, minHeight: coarse ? 44 : undefined,
          padding: '0 var(--space-8) 0 var(--space-4)',
          background: disabled ? 'var(--fill-disabled)' : 'var(--surface-raised)',
          border: `1px solid ${disabled ? 'var(--border-disabled)' : border}`,
          borderRadius: 'var(--radius-lg)',
          boxShadow: focus ? 'var(--focus-ring-inset)' : 'none',
          font: 'inherit', fontFamily: 'var(--font-sans)', fontSize: s.fs, textAlign: 'left',
          color: disabled ? 'var(--text-disabled)' : selected ? 'var(--text-primary)' : 'var(--text-tertiary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'var(--transition-control), box-shadow var(--dur-instant) var(--ease-out)',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="caret-down" size={14} style={{ position: 'absolute', right: 'var(--space-4)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
            zIndex: 'var(--z-popover, 250)',
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-popover)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-default)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              height: s.h, padding: '0 var(--space-4)',
              background: 'var(--surface-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
            }}>
              <Icon name="magnifying-glass" size={14} style={{ color: 'var(--text-tertiary)' }} />
              <input
                ref={inputRef}
                type="text"
                role="searchbox"
                autoComplete="off"
                aria-controls={listId}
                aria-activedescendant={results.length ? optId(active) : undefined}
                value={query}
                placeholder="Filter…"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                style={{
                  flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: 'var(--font-sans)', fontSize: s.fs, color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 240, overflowY: 'auto' }}
          >
            {results.map((o, i) => {
              const isSel = o.value === value;
              const isActive = i === active;
              return (
                <li
                  key={o.value}
                  id={optId(i)}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={o.disabled || undefined}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    minHeight: 44, padding: '0 var(--space-4)',
                    fontFamily: 'var(--font-sans)', fontSize: s.fs,
                    color: o.disabled ? 'var(--text-disabled)' : isSel ? 'var(--text-accent)' : 'var(--text-primary)',
                    background: o.disabled ? 'transparent'
                      : isSel ? 'var(--surface-selected)'
                      : isActive ? 'var(--surface-hover)' : 'transparent',
                    cursor: o.disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  {isSel && <Icon name="check" size={14} style={{ color: 'var(--text-accent)' }} />}
                </li>
              );
            })}

            {results.length === 0 && (
              <li role="option" aria-disabled style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)',
                minHeight: 44, padding: '0 var(--space-4)',
                fontFamily: 'var(--font-sans)', fontSize: s.fs, color: 'var(--text-secondary)',
              }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  No options match “{query.trim()}”
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setQuery(''); inputRef.current?.focus(); }}
                  style={{
                    flex: 'none', border: 'none', background: 'transparent', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', fontSize: s.fs, color: 'var(--text-accent)', padding: 0,
                  }}
                >
                  Clear
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
