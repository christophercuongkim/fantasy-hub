import * as React from 'react';

/**
 * A compact horizontal interval: an achromatic band from `low` to `high` with a
 * marker at `mid`, drawn on a shared `domain` so a column of them compares on one
 * scale. For a projection's floor / expected / ceiling, a confidence interval, any
 * value shown with its range. Achromatic by design so a grid of them stays calm;
 * promote a single instance with `accent`. See decision 0017.
 *
 * @startingPoint section="Data" subtitle="Floor / mid / ceiling on a shared scale" viewport="700x160"
 */
export interface RangeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  /** Interval floor — the left edge of the band. */
  low: number;
  /** The point marker inside the band: a mean, median, or current value. */
  mid: number;
  /** Interval ceiling — the right edge of the band. */
  high: number;
  /** [min, max] scale shared across sibling Ranges so they compare. Defaults to [0, high] (self-scaled). */
  domain?: [number, number];
  size?: 'sm' | 'md';
  /** Promote this one instance to the accent hue — on hover/focus only, one at a
   *  time, never a whole column and never a *selected* row (its accent is already
   *  spent on the row's leading border). */
  accent?: boolean;
  /** Accessible label; defaults to "{low} to {high}, {mid}". */
  label?: string;
  style?: React.CSSProperties;
}
export declare function Range(props: RangeProps): JSX.Element;
