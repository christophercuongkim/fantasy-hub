import * as React from 'react';

/** Small non-interactive status marker. For something the user can remove or toggle, use Tag. */
export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'style'> {
  children?: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  variant?: 'subtle' | 'solid';
  /** Phosphor icon name, rendered bold at 11px. */
  icon?: string;
  /** Leading 5px status dot in the current color. */
  dot?: boolean;
  /** Mono + wide tracking — for counts, scores, codes. */
  mono?: boolean;
  style?: React.CSSProperties;
}
export declare function Badge(props: BadgeProps): JSX.Element;
