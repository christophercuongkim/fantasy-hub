import * as React from 'react';

/**
 * A placeholder shaped like the content that is arriving (decision 0021). Pulses
 * between `--surface-sunken` and `--surface-shimmer`; never spins. Decorative, so
 * it is `aria-hidden` — the surrounding region owns the busy announcement.
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Any CSS length. Defaults to `100%`. */
  width?: string;
  /** Any CSS length. Defaults to `var(--space-6)`. */
  height?: string;
  /** Corner radius. Defaults to `var(--radius-none)`; pass `var(--radius-full)` for a round mask. */
  radius?: string;
  style?: React.CSSProperties;
}
export declare function Skeleton(props: SkeletonProps): JSX.Element;
