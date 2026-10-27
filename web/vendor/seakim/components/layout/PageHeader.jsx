import React from 'react';

/**
 * The one header every page shares: the title as the page's `h1`, a `count`
 * in secondary text beside it, a `badge` chip after that, `actions` on the
 * right (the primary action and the view controls), an optional one-line
 * `description`, and a `toolbar` row under it for the filters. That is the
 * job-search shell pick (spike 1, option A); the references (Linear, Asana,
 * Airtable, Todoist, Whop) agree on the title row and the second row, and put a
 * chip rather than a number beside the title, which is what `badge` is for.
 * Not sticky.
 *
 * On a narrow container the actions stay on the title row (the title wraps,
 * the actions do not) and the toolbar wraps. No fill, no border (0037): the
 * header is type and whitespace.
 */
export function PageHeader({ title, count, badge, description, actions, toolbar, style, ...rest }) {
  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        paddingBottom: 'var(--space-5)',
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {/* break-word, not anywhere: a short title must never split mid-word to make
              room for the count; the count wraps to the next line instead. */}
          <h1 style={{ font: 'var(--type-title)', color: 'var(--text-primary)', margin: 0, overflowWrap: 'break-word' }}>
            {title}
          </h1>
          {count != null && (
            <span style={{ font: 'var(--type-subheading)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          )}
          {badge}
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 'none' }}>
            {actions}
          </div>
        )}
      </div>
      {description && (
        <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', margin: 0, maxWidth: '64ch' }}>
          {description}
        </p>
      )}
      {toolbar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {toolbar}
        </div>
      )}
    </header>
  );
}
