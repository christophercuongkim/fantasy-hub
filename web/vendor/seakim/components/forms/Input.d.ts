import * as React from 'react';

/**
 * Single-line text entry. Square, hairline-bordered, focus shows a 2px inset
 * accent ring. Always inside a `Field`.
 *
 * @startingPoint section="Forms" subtitle="Text entry — sizes, icon, invalid" viewport="700x260"
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'style'> {
  size?: 'sm' | 'md' | 'lg';
  /** Phosphor icon name shown inside the leading edge, e.g. "magnifying-glass". */
  iconLeft?: string;
  /** Static trailing text, e.g. "USD" or "nights". */
  suffix?: React.ReactNode;
  invalid?: boolean;
  /** Set for codes, prices, dates — anything that should align in a column. */
  mono?: boolean;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}
export declare function Input(props: InputProps): JSX.Element;
