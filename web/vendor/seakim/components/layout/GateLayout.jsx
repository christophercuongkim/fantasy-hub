import React from 'react';
import { Card } from '../core/Card.jsx';
import { useMeasuredBreakpoint } from '../core/useMeasuredBreakpoint.js';

/**
 * The page outside the shell: sign-in, a gate ("you are not on the list"),
 * a paywall, a wizard. The brand centred at the top, one `Card` centred in
 * the remaining height (24rem on a desktop, full width on a phone), the
 * footer at the bottom: the job-search gates pick (spike 3, option A). A
 * wizard passes `width="36rem"` and `align="top"` (spike 4). The references
 * (sixteen logins, denied pages and paywalls) put the brand above the content
 * in most and the legal line in a footer in some, so `footer` is optional.
 * Measured on the container.
 */
export function GateLayout({ brand, children, footer, card = true, width = '24rem', align = 'center', style, ...rest }) {
  const { ref, bp } = useMeasuredBreakpoint();
  const narrow = bp === 'sm';
  const body = card ? <Card padding="var(--space-7)">{children}</Card> : children;
  return (
    <div
      ref={ref}
      style={{
        minHeight: '100dvh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: narrow ? 'var(--space-7) var(--space-5) var(--space-5)' : 'var(--space-11) var(--space-7) var(--space-7)',
        boxSizing: 'border-box',
        background: 'var(--surface-page)',
        color: 'var(--text-primary)',
        ...style,
      }}
      {...rest}
    >
      {brand && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-8)', font: 'var(--type-heading)', letterSpacing: 'var(--tracking-tight)' }}>
          {brand}
        </div>
      )}
      <main style={{ width: '100%', maxWidth: width, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: 'var(--space-6)', minWidth: 0 }}>
        {body}
      </main>
      {footer && (
        <footer style={{ marginTop: 'auto', width: '100%', maxWidth: width, paddingTop: 'var(--space-8)', font: 'var(--type-caption)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
          {footer}
        </footer>
      )}
    </div>
  );
}
