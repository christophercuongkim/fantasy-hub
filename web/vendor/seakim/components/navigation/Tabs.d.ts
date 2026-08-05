import * as React from 'react';

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** Phosphor icon name; switches to `fill` when active. */
  icon?: string;
  /** Trailing count `Badge`. Omit when zero rather than showing 0. */
  count?: number;
}

/**
 * Switches between sections of one screen, keeping the surrounding chrome. The
 * 2px accent indicator springs into place; the labels do not move.
 *
 * @startingPoint section="Navigation" subtitle="Section switch with springing indicator" viewport="700x150"
 */
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | 'style'> {
  tabs: Array<TabItem | string>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}
export declare function Tabs(props: TabsProps): JSX.Element;
