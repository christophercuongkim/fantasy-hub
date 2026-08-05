import * as React from 'react';

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  /** One line under the label — use it when options need explaining. */
  hint?: string;
  disabled?: boolean;
}

/**
 * Mutually exclusive choice, whole set always visible. Circular by exception,
 * like `Avatar`. Use for 2–5 options that each need a sentence of explanation;
 * otherwise `SegmentedControl` (short) or `Select` (long).
 */
export interface RadioProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | 'style'> {
  name: string;
  options: Array<RadioOption | string>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  direction?: 'row' | 'column';
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function Radio(props: RadioProps): JSX.Element;
