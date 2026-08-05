import * as React from 'react';

/** Multi-line text entry. Same chrome as `Input`; grows vertically only. */
export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  rows?: number;
  invalid?: boolean;
  style?: React.CSSProperties;
}
export declare function Textarea(props: TextareaProps): JSX.Element;
