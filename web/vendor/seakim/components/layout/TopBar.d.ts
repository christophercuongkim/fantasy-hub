import * as React from 'react';

/**
 * The bar at the top of main: layout.md's 52px top bar, and the screen header on a
 * phone. Back or close, the title (optionally a button with a caret that opens a
 * menu), up to two trailing icon actions. `--surface-card` fill, sticky, raised only
 * while `scrolledUnder`. The top safe-area inset is added above the 52px row.
 */
export interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  /** The screen's name. One line, ellipsised. */
  title: React.ReactNode;
  /** Shows a back control first. Wins over `onClose`. */
  onBack?: () => void;
  /** Shows a close control first, when there is no `onBack`. */
  onClose?: () => void;
  /** Makes the title a button with a caret. */
  onTitleClick?: () => void;
  /** Shown in a `Popover` under the title while `titleMenuOpen`. The content is the app's. */
  titleMenu?: React.ReactNode;
  titleMenuOpen?: boolean;
  /** Escape or a click outside the open `titleMenu`. */
  onTitleMenuDismiss?: () => void;
  /** Up to two `IconButton`s. A third belongs in a menu. */
  actions?: React.ReactNode;
  /** Content is scrolled under the bar: show `--shadow-raised-topbar`. The app tracks its scroll. */
  scrolledUnder?: boolean;
  style?: React.CSSProperties;
}
export declare function TopBar(props: TopBarProps): JSX.Element;
