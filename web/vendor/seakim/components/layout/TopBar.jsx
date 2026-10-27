import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { IconButton } from '../core/IconButton.jsx';
import { Popover } from '../feedback/Popover.jsx';
import { useCoarsePointer } from '../core/useCoarsePointer.js';

/**
 * The bar at the top of main: layout.md's 52px top bar, and the screen header
 * on a phone. A back or close control, the title, up to two trailing icon
 * actions; the trip screens in Tripadvisor, Wanderlog and Vrbo, and the Jira
 * and Trello web bars.
 *
 * `onTitleClick` makes the title a button with a caret. `titleMenu` is shown
 * in a `Popover` under the title while `titleMenuOpen`; the app owns that
 * state, as it does a Popover's, and the menu's content.
 *
 * A `--surface-card` fill with no hairline (0037), sticky at the top of its
 * scroll container. It wears `--shadow-raised-topbar` only while
 * `scrolledUnder` (layout.md's sticky rule): the app knows its scroll offset.
 * The top safe-area inset is added above the 52px row, inside the fill.
 */
export function TopBar({ title, onBack, onClose, onTitleClick, titleMenu, titleMenuOpen = false, onTitleMenuDismiss, actions, scrolledUnder = false, style, ...rest }) {
  const coarse = useCoarsePointer();
  const text = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  let heading = <span style={text}>{title}</span>;
  if (onTitleClick) {
    heading = (
      <button
        type="button"
        onClick={onTitleClick}
        aria-expanded={titleMenu != null ? titleMenuOpen : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0,
          minHeight: coarse ? 'var(--touch-min)' : undefined,
          padding: '0 var(--space-2)', margin: '0 calc(-1 * var(--space-2))',
          border: 'none', background: 'transparent', borderRadius: 'var(--radius-lg)',
          font: 'inherit', color: 'inherit', cursor: 'pointer',
        }}
      >
        <span style={text}>{title}</span>
        <Icon name="caret-down" size={16} style={{ color: 'var(--text-secondary)', flex: 'none' }} />
      </button>
    );
  }
  if (titleMenu != null) {
    heading = <Popover open={titleMenuOpen} onDismiss={onTitleMenuDismiss} trigger={heading}>{titleMenu}</Popover>;
  }
  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 'var(--z-sticky)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'var(--surface-card)',
        boxShadow: scrolledUnder ? 'var(--shadow-raised-topbar)' : 'none',
        transition: 'box-shadow var(--dur-base) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      <div style={{ height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '0 var(--space-3)' }}>
        {onBack && <IconButton icon="arrow-left" label="Back" onClick={onBack} />}
        {!onBack && onClose && <IconButton icon="x" label="Close" onClick={onClose} />}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', paddingLeft: onBack || onClose ? 0 : 'var(--space-3)', font: 'var(--type-subheading)', color: 'var(--text-primary)' }}>
          {heading}
        </div>
        {actions && <div style={{ display: 'inline-flex', gap: 'var(--space-2)', flex: 'none' }}>{actions}</div>}
      </div>
    </header>
  );
}
