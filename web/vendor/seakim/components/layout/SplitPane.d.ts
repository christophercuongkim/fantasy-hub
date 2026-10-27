import * as React from 'react';

/**
 * A list beside its detail, with an optional properties column. Layout only; the
 * URL and the selection are the app's. Under `md` it shows the list or, when
 * `detailOpen`, the detail; from `md` both; from `lg` the aside too.
 */
export interface SplitPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The left column: a ListGroup of ListRows, usually. Scrolls on its own. */
  list: React.ReactNode;
  /** The detail column. Start it with a `SplitPane.Header`. */
  detail: React.ReactNode;
  /** A properties column right of the detail. Shown from `lg`. */
  aside?: React.ReactNode;
  /** On a narrow container, show the detail instead of the list. */
  detailOpen?: boolean;
  /** Called by the header's back control on a narrow container. */
  onBack?: () => void;
  /** Any CSS length. Defaults to `24rem`. */
  listWidth?: string;
  /** Any CSS length. Defaults to `20rem`. */
  asideWidth?: string;
  style?: React.CSSProperties;
}

/** The detail column's header: back or close, title, counter, prev/next, actions. Sticky. */
export interface SplitPaneHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: React.ReactNode;
  /** "3 of 12". */
  counter?: string;
  /** Shows a close control from `md`; Escape in the detail calls it too. */
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function SplitPane(props: SplitPaneProps): JSX.Element;
/** The same header as `SplitPane.Header`, importable by name from a Server Component. */
export declare function SplitPaneHeader(props: SplitPaneHeaderProps): JSX.Element;
export declare namespace SplitPane {
  function Header(props: SplitPaneHeaderProps): JSX.Element;
}
