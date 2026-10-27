import * as React from 'react';

/**
 * The one header every page shares: the title as the page's `h1`, a badge beside
 * it, actions on the right, an optional description, and a toolbar row for filters,
 * tabs, sort and the view toggle. Not sticky. On a narrow container the title wraps,
 * the actions stay on the row, the toolbar wraps.
 */
export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** The page's name. Rendered as the `h1`; one per page. */
  title: React.ReactNode;
  /** The count, in secondary text beside the title: 12 postings. */
  count?: number | string;
  /** A `Badge` or `Tag` after the title: a status ("On track"), a plan ("Trial"). */
  badge?: React.ReactNode;
  /** One line under the title. Rarely needed on a list page. */
  description?: React.ReactNode;
  /** Right of the title: the view controls and the primary action. Keep to three. */
  actions?: React.ReactNode;
  /** The second row: the filters, tabs, sort. Wraps on a narrow container. */
  toolbar?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function PageHeader(props: PageHeaderProps): JSX.Element;
