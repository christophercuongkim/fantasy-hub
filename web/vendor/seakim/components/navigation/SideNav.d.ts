import * as React from 'react';

export interface SideNavItem {
  /** Identity for the `active` comparison. Falls back to `label`. */
  value?: string;
  label: string;
  /** Phosphor icon name; `fill` weight marks the active item. */
  icon: string;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  /** Right-aligned count or badge. */
  trailing?: React.ReactNode;
}

export interface SideNavGroup {
  /** Uppercase mono eyebrow. Omit for the first, unlabelled group. */
  label?: string;
  items: SideNavItem[];
}

/**
 * Persistent left navigation for web app surfaces. 232px, collapses to 56px
 * icons. The active item is the only accent-colored thing in the nav.
 */
export interface SideNavProps extends React.HTMLAttributes<HTMLElement> {
  /** Wordmark. Renders its first letter when collapsed. */
  brand?: React.ReactNode;
  groups: SideNavGroup[];
  /** The active item's `value`. */
  active?: string;
  collapsed?: boolean;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function SideNav(props: SideNavProps): JSX.Element;
