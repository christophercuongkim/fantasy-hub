import * as React from 'react';

export interface StepperStep {
  key: string;
  label: string;
  /** One short line under the label: a date, a wait. */
  description?: string;
}

/**
 * A labelled pipeline: every step named, the current one filled, the ones behind it
 * checked, the ones ahead outlined. Horizontal from `md`, vertical under it when
 * `orientation` is `auto`. Pass `onSelect` only for the moves the app allows; the
 * steps then become buttons.
 */
export interface StepperProps extends Omit<React.OlHTMLAttributes<HTMLOListElement>, 'onSelect'> {
  steps: StepperStep[];
  /** The key of the current step. Steps before it are done, after it upcoming. */
  current?: string;
  orientation?: 'auto' | 'horizontal' | 'vertical';
  onSelect?: (key: string) => void;
  style?: React.CSSProperties;
}
export declare function Stepper(props: StepperProps): JSX.Element;
