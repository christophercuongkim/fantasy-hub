import React, { useState } from 'react';

/** Hover/focus label for an unlabelled control. Never contains anything clickable. */
export function Tooltip({ label, side = 'top', children, style, ...rest }) {
  const [show, setShow] = useState(false);
  const pos = {
    top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
    left:   { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 },
    right:  { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 },
  }[side];
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      {...rest}
    >
      {children}
      {show && (
        <span role="tooltip" style={{
          position: 'absolute', ...pos, zIndex: 'var(--z-tooltip, 500)',
          padding: '5px var(--space-4)', whiteSpace: 'nowrap', pointerEvents: 'none',
          background: 'var(--surface-overlay)', border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-popover)', borderRadius: 'var(--radius-none)',
          font: 'var(--type-caption)', color: 'var(--text-primary)',
          animation: 'sk-tip-in var(--dur-fast) var(--ease-out) both',
        }}>{label}</span>
      )}
      <style>{'@keyframes sk-tip-in{from{opacity:0;transform:' + (pos.transform || 'none') + ' translateY(2px)}}'}</style>
    </span>
  );
}
