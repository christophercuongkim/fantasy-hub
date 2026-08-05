import * as React from 'react';

export interface SegmentOption {
  value: string;
  label: React.ReactNode;
  /** Phosphor icon name. Switches to `fill` weight when selected. */
  icon?: string;
}

/**
 * 2–4 mutually exclusive short options, all visible at once. Use for view
 * switches and filter modes; not for navigation (that is `Tabs`).
 *
 * @startingPoint section="Forms" subtitle="Exclusive short options, all visible" viewport="700x150"
 */
export interface SegmentedControlProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | 'style'> {
  options: Array<SegmentOption | string>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  style?: React.CSSProperties;
}
export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element;
