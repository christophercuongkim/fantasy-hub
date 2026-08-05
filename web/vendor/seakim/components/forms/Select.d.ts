import * as React from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Native single-choice select with system chrome. Use for 4+ options; below that
 * use `SegmentedControl` or `Radio`.
 */
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'style' | 'children'> {
  options?: Array<SelectOption | string>;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  /** Renders as an empty-value first option. */
  placeholder?: string;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}
export declare function Select(props: SelectProps): JSX.Element;
