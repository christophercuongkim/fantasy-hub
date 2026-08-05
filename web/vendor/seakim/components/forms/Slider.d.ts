import * as React from 'react';

/**
 * Coarse adjustment along a continuous or stepped range.
 *
 * A fader, not a dial: 4px track, a 12×20 vertical bar thumb, and the value
 * always readable as text beside the label. Per decision 0006.
 *
 * **Not for** exact values that matter — a price cap, a budget, a passenger count.
 * Pair with a mono `Input` or use the input alone. Not for choosing between named
 * options; that is `SegmentedControl` or `Select`.
 *
 * @startingPoint section="Forms" subtitle="Single and range, ticks, disabled" viewport="700x260"
 */
export interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'style'> {
  min?: number;
  max?: number;
  /** Omit or pass 0 for a continuous range. */
  step?: number;
  /** A number, or `[min, max]` when `range` is set. */
  value: number | [number, number];
  onChange?: (value: any) => void;
  /** Two thumbs. They may meet but never cross. */
  range?: boolean;
  label?: string;
  hint?: string;
  /** Formats the value text, e.g. `v => '$' + v`. */
  format?: (value: number) => string;
  /** Only honoured when `step` is set and there are fewer than 12 steps. */
  ticks?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function Slider(props: SliderProps): JSX.Element;
