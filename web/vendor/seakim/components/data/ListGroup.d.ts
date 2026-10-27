import * as React from 'react';

/** A run of `ListRow`s under one eyebrow heading, with hairline dividers between rows or none. */
export interface ListGroupProps extends React.HTMLAttributes<HTMLElement> {
  /** An eyebrow: "Account", "Yesterday". Labels the list for assistive technology. */
  heading?: React.ReactNode;
  /** `hairline` (default) draws `--border-subtle` between rows; `none` leaves a gap instead. */
  divider?: 'hairline' | 'none';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function ListGroup(props: ListGroupProps): JSX.Element;
