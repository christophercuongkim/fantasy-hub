import * as React from 'react';

/**
 * An immediate on/off for a setting — no save step. The knob springs across with
 * `--ease-spring`, the one place overshoot is visible in a control.
 */
export interface SwitchProps extends Omit<React.HTMLAttributes<HTMLLabelElement>, 'onChange' | 'style'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Sits at the leading edge; the switch pushes to the trailing edge. */
  label?: React.ReactNode;
  hint?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function Switch(props: SwitchProps): JSX.Element;
