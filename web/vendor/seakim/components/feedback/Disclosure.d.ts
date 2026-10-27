import * as React from 'react';

/**
 * One collapsible section over native `<details>`/`<summary>`: a summary row with an
 * optional meta on its right and a chevron, the body below. Several stack and more
 * than one may be open; it never closes a sibling. Controlled with `open` and
 * `onToggle`, or uncontrolled with `defaultOpen`.
 */
export interface DisclosureProps extends Omit<React.DetailsHTMLAttributes<HTMLDetailsElement>, 'open' | 'onToggle'> {
  /** The row's text. A short noun phrase: "Fare breakdown", "How the 79 breaks down". */
  summary: React.ReactNode;
  /** A count or value on the closed row, right of the summary: "4 items", "1 of 1". */
  meta?: React.ReactNode;
  /** Controlled open state. Omit for uncontrolled. */
  open?: boolean;
  /** Initial state when uncontrolled. Defaults to closed. */
  defaultOpen?: boolean;
  /** Called with the new state after the user toggles. */
  onToggle?: (open: boolean) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Disclosure(props: DisclosureProps): JSX.Element;
