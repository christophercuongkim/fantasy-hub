import * as React from 'react';

/**
 * A modal that interrupts. Reserve it for decisions that must be made now —
 * destructive confirmations, payment, a required choice. Never for information.
 * Title is a sentence-case statement; the confirm button repeats the verb.
 */
export interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  title?: string;
  /** One or two sentences. What happens, and what it costs. */
  description?: string;
  children?: React.ReactNode;
  /** Buttons, trailing-aligned. Cancel is ghost, the action is primary or danger. */
  footer?: React.ReactNode;
  /** Omit to make the dialog non-dismissible. */
  onClose?: () => void;
  width?: number;
  style?: React.CSSProperties;
}
export declare function Dialog(props: DialogProps): JSX.Element | null;
