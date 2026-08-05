import * as React from 'react';

/**
 * What a container says before it has contents. Always names the thing that goes
 * here and offers the action that creates it. Never an apology, never an emoji.
 * The one place a dashed border is allowed.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Phosphor icon name, 32px, tertiary. */
  icon?: string;
  title?: string;
  description?: string;
  /** Usually a single primary `Button`. */
  action?: React.ReactNode;
  /** Tighter padding, for empty panels rather than empty pages. */
  compact?: boolean;
  style?: React.CSSProperties;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
