import * as React from 'react';

/**
 * layout.md pattern 2: primary content beside a rail of secondary panels. Measured on
 * its own container. At `lg` side by side with a hairline, each scrolling on its own;
 * below `lg` the rail stacks after the content (`railBelow`, default) or is hidden.
 * Give it a height.
 */
export interface ContentRailProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The primary pane. Its padding is its own (a `PageBody`, usually). */
  content: React.ReactNode;
  /** The secondary panels, one child each, top to bottom. */
  rail: React.ReactNode;
  /** Pixels, 300 to 320. Defaults to 300. */
  railWidth?: number;
  /**
   * Below `lg`: true (default) moves the rail under the content; false hides it, only for
   * a pane that cannot have anything under it, such as a chat thread over its composer.
   */
  railBelow?: boolean;
  style?: React.CSSProperties;
}
export declare function ContentRail(props: ContentRailProps): JSX.Element;
