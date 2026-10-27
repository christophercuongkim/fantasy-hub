import * as React from 'react';

/**
 * A determinate linear progress bar: thin track, accent fill, optional label after
 * it. For a thing moving towards a known end (a wizard step count, an upload). A
 * measurement that is not going anywhere is a `Meter`; an unknown wait is a
 * `Skeleton` or `LoadingState` (0021).
 */
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current value, clamped to `0..max`. */
  value?: number;
  /** Defaults to 100. */
  max?: number;
  /** Caption after the bar, e.g. "4 of 13". Names the bar for assistive technology; without it pass `aria-label`. */
  label?: string;
  /** `sm` is a 4px track (the default, what a wizard uses); `md` is 8px, for an upload row. */
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}
export declare function Progress(props: ProgressProps): JSX.Element;
