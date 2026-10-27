import React, { useId } from 'react';

/**
 * A run of `ListRow`s under one heading, with the dividers between them. The
 * heading is an eyebrow ("ACCOUNT", "YESTERDAY"); the divider is a hairline
 * (`--border-subtle`, the one place 0037 keeps one: between rows) or none, for
 * rows that are cards with a gap. Renders a list, so assistive technology
 * announces the count and the rows belong to the heading.
 */
export function ListGroup({ heading, children, divider = 'hairline', style, ...rest }) {
  const id = useId();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', ...style }} {...rest}>
      {heading != null && (
        <div id={id} style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '0 var(--space-5)' }}>
          {heading}
        </div>
      )}
      <ul aria-labelledby={heading != null ? id : undefined} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: divider === 'none' ? 'var(--space-3)' : 0 }}>
        {items.map((child, i) => (
          <li key={child.key ?? i} style={{ borderTop: divider === 'hairline' && i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}
