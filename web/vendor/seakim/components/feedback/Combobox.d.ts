import * as React from 'react';

/** One row of a Combobox. A bare string is shorthand for `{ value: s, label: s }`. */
export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * A searchable long-list picker (decision 0028). A fully custom `role="combobox"`
 * widget — reach for it over `Select` when the user must *search* rather than
 * *scan* (currency, timezone, country). Filters and ranks with the shared matcher;
 * substring-tiered by default, fuzzy opt-in per picker.
 */
export interface ComboboxProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Options as objects, or bare strings used as both value and label. */
  options: Array<ComboboxOption | string>;
  /** The currently selected value. */
  value?: string;
  /** Called with the chosen option's value on pick. */
  onChanged?: (value: string) => void;
  /** Trigger text when nothing is selected. */
  placeholder?: string;
  /** Field label rendered above the trigger. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  disabled?: boolean;
  /** Opt in to scored-subsequence ranking; default is predictable substring tiers. */
  fuzzy?: boolean;
  style?: React.CSSProperties;
}

export declare function Combobox(props: ComboboxProps): JSX.Element;
