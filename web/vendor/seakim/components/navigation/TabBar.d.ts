import * as React from 'react';

export interface TabBarItem {
  value?: string;
  label: string;
  /** Phosphor icon name; `fill` weight marks the active destination. */
  icon: string;
}

/**
 * Mobile bottom navigation: 3–5 top-level destinations, never more. Each target
 * clears 44px. The active icon springs up 1px — the only motion in the bar.
 */
export interface TabBarProps extends React.HTMLAttributes<HTMLElement> {
  items: TabBarItem[];
  active?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}
export declare function TabBar(props: TabBarProps): JSX.Element;
