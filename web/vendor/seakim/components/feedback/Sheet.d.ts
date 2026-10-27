import * as React from 'react';

/**
 * A short list of actions or a picker: a bottom sheet under `md`, the same panel
 * centred from `md` up (the twin of Flutter's `showSkSheet`). Grabber on the phone,
 * no title by default, no close button; the scrim and Escape dismiss.
 */
export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  /** The scrim and Escape call it. Omit to make the sheet non-dismissible. */
  onClose?: () => void;
  /** Off by default; the references show none. Also the dialog's label. */
  title?: string;
  /** Usually `ListRow`s. A form belongs in a `Dialog`. */
  children?: React.ReactNode;
  /** The panel width from `md`. Defaults to `var(--overlay-w-sheet, 460px)`. */
  width?: string;
  style?: React.CSSProperties;
}
export declare function Sheet(props: SheetProps): JSX.Element | null;
