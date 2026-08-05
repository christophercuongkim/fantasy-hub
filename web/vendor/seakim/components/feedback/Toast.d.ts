import * as React from 'react';

/**
 * Transient confirmation of something that already happened. Bottom-trailing,
 * one at a time, auto-dismissing. Never for errors that need a decision — that
 * is a `Dialog`.
 */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Past tense, no exclamation mark. "Trip saved". "Lineup locked". */
  message: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  /** One optional recovery action, usually "Undo". */
  action?: () => void;
  actionLabel?: string;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}
export declare function Toast(props: ToastProps): JSX.Element;
