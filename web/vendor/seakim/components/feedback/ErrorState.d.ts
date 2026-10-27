import * as React from 'react';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Error-toned glyph name. Defaults to `warning`, drawn in `--text-danger`. */
  icon?: string;
  /** States the failure. */
  title?: string;
  /** Cause, consequence, next step — one sentence each, max. */
  description?: string;
  /** Retry handler. Renders the default `Try again` recovery button. */
  onRetry?: () => void;
  /** Label for the default retry button. */
  retryLabel?: string;
  /** Overrides the default retry button — use for a terminal error's navigational
   *  escape (go back / go home) where retrying cannot help. */
  action?: React.ReactNode;
  compact?: boolean;
  style?: React.CSSProperties;
}

export declare function ErrorState(props: ErrorStateProps): JSX.Element;
