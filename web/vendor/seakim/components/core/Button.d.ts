import * as React from 'react';

/**
 * The system's action primitive. Sentence case, verb first, 1–3 words.
 * One primary button per view; everything else is secondary or ghost.
 * Never show a spinner — set `loading` and the label swaps to a mono progress word.
 *
 * @startingPoint section="Core" subtitle="Action primitive — 4 variants, 3 sizes" viewport="700x220"
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children?: React.ReactNode;
  /** primary = the one action that matters. danger only for destructive, irreversible actions. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Phosphor icon name, e.g. "plus". */
  iconLeft?: string;
  iconRight?: string;
  /** Locks the button and swaps the label for `loadingLabel`. */
  loading?: boolean;
  /** Mono progress word, e.g. "Booking…". */
  loadingLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
