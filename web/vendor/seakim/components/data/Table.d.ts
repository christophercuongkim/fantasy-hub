import * as React from 'react';

/**
 * One column of a `Table`. The responsive metadata is the part that cannot be
 * derived — see decision 0003: every table declares by hand which columns drop
 * first, which single figure survives to `sm`, and what the secondary line says.
 */
export interface TableColumn<T = any> {
  key: string;
  label: string;
  /** Renders the cell. Defaults to `row[key]`. */
  render?: (row: T) => React.ReactNode;
  /** Mono, tabular, right-aligned. Use for anything compared down a column. */
  numeric?: boolean;
  /** The leftmost identifying column. Never dropped, and it becomes the primary line at `sm`. */
  identifying?: boolean;
  /** Joined with `·` into the secondary line at `sm`. */
  secondary?: boolean;
  /** The one numeric column that survives to `sm`. */
  survives?: boolean;
  /** Small line under the surviving figure at `sm`, e.g. `proj 18.4`. */
  subLabel?: (row: T) => React.ReactNode;
  /** 3 drops at `md`. Omit to always show. */
  priority?: 1 | 2 | 3;
  sortable?: boolean;
  width?: number | string;
}

export interface TableSort {
  key: string;
  dir: 'asc' | 'desc';
}

/**
 * Rows of records with shared columns, where the point is comparison.
 *
 * From `md` up this is a real table with a sticky header and hover-revealed row
 * actions. At `sm` rows change species into stacked list rows — not a fallback,
 * a different layout, because a six-column table cannot be read on a phone and
 * horizontal scroll takes the sort control off screen.
 *
 * Not for layout, not for a single record's key/value pairs, and not for a list you
 * only ever read one item at a time. If no column is compared across rows, it is
 * not a table.
 *
 * @startingPoint section="Data" subtitle="Sortable table, two densities, sm list rows" viewport="900x420"
 */
export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  rows: T[];
  /** Measured breakpoint from `Viewport`. Decides table vs list rows. */
  bp?: 'sm' | 'md' | 'lg';
  /** `compact` only for numeric matrices with no in-row controls. */
  density?: 'comfortable' | 'compact';
  sort?: TableSort;
  onSort?: (key: string) => void;
  selectedKey?: string | number;
  rowKey?: (row: T) => string | number;
  onSelectRow?: (row: T) => void;
  /** Trailing cell. Revealed on hover, but always focusable. */
  actions?: (row: T) => React.ReactNode;
  /** Shown instead of the body when `rows` is empty. Distinguish "empty" from "filtered to nothing". */
  empty?: React.ReactNode;
  /** Every scrolling column shares a unit, so it may scroll at `sm` instead of restacking. */
  matrix?: boolean;
  /** Screen-reader description of what the table contains. */
  caption?: string;
}
export declare function Table<T = any>(props: TableProps<T>): JSX.Element;
