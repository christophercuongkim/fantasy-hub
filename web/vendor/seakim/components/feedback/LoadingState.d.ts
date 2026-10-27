import * as React from 'react';

/**
 * Loading when you know only that something is arriving — a route boot, a gate
 * (decision 0021). Names the thing being fetched, announces itself busy, reuses
 * `EmptyState`'s centred frame without the dashed border, and shows a static
 * linear bar — never a spinner.
 */
export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Names the thing being fetched, e.g. "Checking 40 airlines…". */
  title?: string;
  description?: string;
  /** Tighter padding, for a panel rather than a full page. */
  compact?: boolean;
  style?: React.CSSProperties;
}
export declare function LoadingState(props: LoadingStateProps): JSX.Element;
