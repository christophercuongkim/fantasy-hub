import * as React from 'react';

/**
 * Kanban columns: a sunken fill per column, 22rem wide, a header with label, count, an
 * optional status dot and a menu, cards as the app's content, a footer for the add row.
 * Empty columns collapse by default. Under `md` the row is a scroll-snap strip with one
 * column at 85%, a `Tabs` row of the stages above it and page dots under.
 */
export interface BoardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `BoardColumn`s. */
  children?: React.ReactNode;
  /** Collapse empty columns to a narrow vertical header that expands on click. On by default; pass `false` to keep them full width. */
  collapseEmpty?: boolean;
  /** Any CSS length. Defaults to `22rem`. */
  columnWidth?: string;
  style?: React.CSSProperties;
}

export interface BoardColumnProps extends React.HTMLAttributes<HTMLElement> {
  label: React.ReactNode;
  count?: number;
  /** A status dot before the label, in the status colour. */
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'accent';
  /** Right of the header: an IconButton with a Popover, usually. */
  menu?: React.ReactNode;
  /** The add row at the column's foot. */
  footer?: React.ReactNode;
  /** The cards. Each is wrapped as a list item. */
  children?: React.ReactNode;
  /** Override the empty check (the column has no children but is not empty, or vice versa). */
  empty?: boolean;
  style?: React.CSSProperties;
}

export declare function Board(props: BoardProps): JSX.Element;
export declare function BoardColumn(props: BoardColumnProps): JSX.Element;
