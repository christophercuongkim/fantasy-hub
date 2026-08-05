import * as React from 'react';

/**
 * A date field, and the calendar grid that opens from it. Per decision 0004.
 *
 * The grid is an affordance over a mono text input, never the only way in — a
 * returning traveller who knows the date types it faster, and a keyboard or
 * screen-reader user gets a real field instead of a grid to arrow through.
 *
 * Square cells with a 1px gap mean a selected range renders as one continuous bar,
 * which is where the 0px rule beats the platform default rather than fighting it.
 *
 * **There is no time picker.** A time is a mono `Input`, or a `Select` when the
 * choices are genuinely enumerable.
 *
 * @startingPoint section="Forms" subtitle="Single date and range, with the calendar open" viewport="700x420"
 */
export interface DatePickerProps {
  /** A `Date` normally, or `[start, end]` when `range` is set. */
  value?: Date | [Date | null, Date | null] | null;
  onChange?: (value: any) => void;
  /** Two endpoints. Picking before the start reorders rather than rejecting. */
  range?: boolean;
  label?: string;
  hint?: string;
  /** Replaces `hint`. Follow the three-facts rule: cause, consequence, next step. */
  error?: string;
  /** Return true to make a date unselectable. Give a reason in the UI where one exists. */
  isDisabled?: (date: Date) => boolean;
  /** Measured breakpoint. At `sm` the overlay becomes a bottom sheet. */
  bp?: 'sm' | 'md' | 'lg';
  /** Months shown side by side. Defaults to 2 for a range at `lg`, otherwise 1. */
  months?: number;
  style?: React.CSSProperties;
}
export declare function DatePicker(props: DatePickerProps): JSX.Element;
