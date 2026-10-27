import React, { useEffect, useRef } from 'react';
import { useWindowBreakpoint } from '../core/useMeasuredBreakpoint.js';

/**
 * A short list of actions or a picker, reached from one tap: a bottom sheet
 * under `md`, the same panel centred from `md` up, which is exactly what
 * Flutter's `showSkSheet` does and why this is the React twin. The one sheet
 * reference (LinkedIn): a grabber, no title, no close control, plain rows,
 * content-sized, a scrim. So `title` is off by default and there is no close
 * button; the scrim and Escape dismiss.
 *
 * Measured against the window, not a container, because an overlay is not in
 * one. Like `Dialog` it does not animate in (0034: overlays fade, nothing
 * grows; the fade is the scrim's and reduced motion has nothing to zero).
 * Focus moves into the panel on open and back to the opener on close.
 * Children are usually `ListRow`s; a form belongs in a `Dialog`.
 */
export function Sheet({ open = false, onClose, title, children, width = 'var(--overlay-w-sheet, 460px)', style, ...rest }) {
  const bp = useWindowBreakpoint();
  const narrow = bp === 'sm';
  const panel = useRef(null);
  const opener = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    opener.current = typeof document !== 'undefined' ? document.activeElement : null;
    if (panel.current) panel.current.focus();
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener.current && opener.current.focus) opener.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal, 300)',
        background: 'var(--surface-scrim)',
        display: 'flex', justifyContent: 'center',
        alignItems: narrow ? 'flex-end' : 'center',
        padding: narrow ? 0 : 'var(--space-7)',
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog" aria-modal="true" aria-label={title || 'Sheet'}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: narrow ? 'none' : width,
          maxHeight: narrow ? '82dvh' : 'calc(100dvh - 2 * var(--space-7))',
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-default)',
          borderBottom: narrow ? 'none' : undefined,
          borderRadius: narrow ? 'var(--radius-xl) var(--radius-xl) 0 0' : 'var(--radius-xl)',
          boxShadow: 'var(--shadow-dialog)',
          display: 'flex', flexDirection: 'column', overflow: 'auto', outline: 'none',
          ...style,
        }}
        {...rest}
      >
        {narrow && (
          <span aria-hidden="true" style={{ width: 'var(--space-9)', height: 'var(--space-2)', borderRadius: 'var(--radius-full)', background: 'var(--border-strong)', margin: 'var(--space-3) auto 0', flex: 'none' }} />
        )}
        {title && <h2 style={{ font: 'var(--type-heading)', letterSpacing: 'var(--tracking-tight)', margin: 0, padding: 'var(--space-5) var(--space-5) 0' }}>{title}</h2>}
        <div style={{ padding: 'var(--space-3) 0 var(--space-5)' }}>{children}</div>
      </div>
    </div>
  );
}
