import React, { useState } from 'react';
import { Icon } from './Icon.jsx';
import { useCoarsePointer } from './useCoarsePointer.js';

export function Tag({ children, icon, selected = false, onRemove, onClick, disabled = false, style, ...rest }) {
  const [hover, setHover] = useState(false);
  const coarse = useCoarsePointer();
  const clickable = !!onClick && !disabled;
  return (
    <span
      onClick={clickable ? onClick : undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)',
        height: 'var(--control-h-sm)', minHeight: coarse ? 44 : undefined,
        padding: `0 ${onRemove ? 'var(--space-2)' : 'var(--space-4)'} 0 var(--space-4)`,
        borderRadius: 'var(--radius-xs)', cursor: clickable ? 'pointer' : 'default', opacity: 1,
        // A chip is a fill (0037); only the selected chip carries an edge.
        background: selected ? 'var(--surface-selected)' : hover && clickable ? 'var(--fill-neutral-hover)' : 'var(--fill-neutral)',
        border: `1px solid ${selected ? 'var(--border-accent)' : 'transparent'}`,
        color: selected ? 'var(--text-accent)' : 'var(--text-primary)',
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)',
        transition: 'var(--transition-control)', ...style,
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={13} weight={selected ? 'fill' : 'regular'} />}
      {children}
      {onRemove && (
        <button type="button" aria-label="Remove" onClick={(e) => { e.stopPropagation(); onRemove(e); }}
          style={{ display: 'inline-flex', width: 18, height: 18,
                   minWidth: coarse ? 44 : undefined, minHeight: coarse ? 44 : undefined,
                   alignItems: 'center', justifyContent: 'center',
                   background: 'transparent', border: 0, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
          <Icon name="x" size={11} weight="bold" />
        </button>
      )}
    </span>
  );
}
