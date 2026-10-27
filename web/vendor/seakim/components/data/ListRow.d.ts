import * as React from 'react';

/**
 * One row of a list: leading, a stacked eyebrow/title/meta, trailing. The same box
 * is a one-line settings row and a three-line record row; height comes from the
 * content. `href` renders a link, `onClick` a button, neither a plain block.
 * `selected` is a fill and sets `aria-current`.
 */
export interface ListRowProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'onClick'> {
  /** An Avatar, a logo, a Checkbox, an Icon. */
  leading?: React.ReactNode;
  /** A caps line above the title: a company, a date group. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** One or two lines under the title, secondary colour. */
  meta?: React.ReactNode;
  /** A value, a time, a chevron, a kebab IconButton, a Switch, a Tag. */
  trailing?: React.ReactNode;
  /** The current row in a split view. A fill, never a bar. */
  selected?: boolean;
  /** Renders an `<a>`. */
  href?: string;
  /** Renders a `<button>`. */
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function ListRow(props: ListRowProps): JSX.Element;
