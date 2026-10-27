import * as React from 'react';

/**
 * The page outside the shell: sign-in, a gate, a paywall, a wizard. Brand centred
 * at the top, one `Card` centred in the remaining height (24rem, full width on a
 * phone), optional footer at the bottom. A wizard passes `width="36rem"` and
 * `align="top"`. Fills the viewport (`min-height: 100dvh`); pass `style` to override
 * in a demo.
 */
export interface GateLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The wordmark or mark. Not a heading; the page's `h1` is in `children`. */
  brand?: React.ReactNode;
  /** The column: a heading, copy, controls. */
  children?: React.ReactNode;
  /** The legal line or a support link, pinned to the bottom. */
  footer?: React.ReactNode;
  /** Wrap the column in a `Card`. On by default (the gates pick). */
  card?: boolean;
  /** Any CSS length. Defaults to `24rem`; a wizard uses `36rem`. */
  width?: string;
  /** Where the column sits in the remaining height. `center` for a gate, `top` for a wizard. */
  align?: 'center' | 'top';
  style?: React.CSSProperties;
}
export declare function GateLayout(props: GateLayoutProps): JSX.Element;
