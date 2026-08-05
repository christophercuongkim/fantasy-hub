import * as React from 'react';

/**
 * Names an unlabelled control on hover and focus. 1–4 words, sentence case, no
 * terminal punctuation. Never holds a link, a button, or information the user
 * needs to complete the task.
 */
export interface TooltipProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Tooltip(props: TooltipProps): JSX.Element;
