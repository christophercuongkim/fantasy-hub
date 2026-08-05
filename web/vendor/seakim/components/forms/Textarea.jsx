import React, { useState } from 'react';

export function Textarea({ rows = 4, invalid = false, disabled = false, style, ...rest }) {
  const [focus, setFocus] = useState(false);
  const [hover, setHover] = useState(false);
  const border = invalid ? 'var(--text-danger)' : focus ? 'var(--border-focus)' : hover && !disabled ? 'var(--border-strong)' : 'var(--border-default)';
  return (
    <textarea
      rows={rows}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={e => { setFocus(true); rest.onFocus && rest.onFocus(e); }}
      onBlur={e => { setFocus(false); rest.onBlur && rest.onBlur(e); }}
      {...rest}
      style={{
        width: '100%', resize: 'vertical', padding: 'var(--space-4)',
        background: disabled ? 'var(--fill-disabled)' : 'var(--surface-raised)',
        border: `1px solid ${disabled ? 'var(--border-disabled)' : border}`, borderRadius: 'var(--radius-none)',
        boxShadow: focus ? 'var(--focus-ring-inset)' : 'none',
        outline: 'none', font: 'var(--type-body-sm)', color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
        
        transition: 'var(--transition-control), box-shadow var(--dur-instant) var(--ease-out)',
        ...style,
      }}
    />
  );
}
