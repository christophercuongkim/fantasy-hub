import * as React from 'react';

/**
 * The wrapper that gives a control its label, hint, and error line. Labels are
 * sentence case with no colon; hints are one line; errors replace the hint.
 */
export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  /** One line of help. Replaced by `error` when present. */
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Field(props: FieldProps): JSX.Element;
