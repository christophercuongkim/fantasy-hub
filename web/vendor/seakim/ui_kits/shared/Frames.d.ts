import * as React from 'react';

/** Container-width thresholds. sm under 640 · md 640–1023 · lg 1024 and up. */
export declare const BREAKPOINTS: { sm: 0; md: 640; lg: 1024 };

export type SkBreakpoint = 'sm' | 'md' | 'lg';

/** Which breakpoint a measured width falls in. */
export declare function breakpointFor(width: number): SkBreakpoint;

/**
 * Measures the element it is attached to, not the viewport — the system branches
 * on container width so a component nested in a narrow column behaves narrow.
 */
export declare function useMeasuredBreakpoint(): {
  ref: React.RefObject<HTMLElement | null>;
  width: number;
  bp: SkBreakpoint;
};

export interface ViewportProps {
  /** Pin to a fixed width to preview a breakpoint. 0 measures the real container. */
  width?: number;
  children?: React.ReactNode;
}

/** Frame that pins a width so a screen can be reviewed at one breakpoint. */
export declare function Viewport(props: ViewportProps): React.JSX.Element;
