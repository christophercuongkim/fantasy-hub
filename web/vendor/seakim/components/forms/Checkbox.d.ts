import * as React from 'react';

/**
 * Independent on/off for a single option, or many in a list. Square, 16px, accent
 * fill when checked. For "does this setting apply" use `Switch` instead.
 */
export interface CheckboxProps extends Omit<React.HTMLAttributes<HTMLLabelElement>, 'onChange' | 'style'> {
  checked?: boolean;
  defaultChecked?: boolean;
  /** Mixed state for a parent of partially-selected children. */
  indeterminate?: boolean;
  label?: React.ReactNode;
  /** One line under the label. */
  hint?: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  style?: React.CSSProperties;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
