import * as React from 'react';

/**
 * A single measured figure: uppercase mono label, tabular mono value, optional delta.
 * Used for fares and durations in Voyage, points and projections in Bench.
 * Never animate the value — see the motion rules in readme.md.
 *
 * @startingPoint section="Core" subtitle="Label / value / delta figure" viewport="700x160"
 */
export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  /** Small trailing unit, e.g. "pts", "kg", "%". */
  unit?: string;
  /** Signed change, e.g. "+2.4" or "-18". A leading "-" implies `down`. */
  delta?: string | number;
  deltaDirection?: 'up' | 'down';
  /** One short line under the value. */
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right';
  style?: React.CSSProperties;
}
export declare function Stat(props: StatProps): JSX.Element;
