import * as React from 'react';

/**
 * Trigger-anchored contextual overlay — the third overlay species (0022). Sits
 * next to the element that spawned it, because its meaning is "this, here": a
 * menu under a button, an autocomplete list under a field, a reaction bar.
 *
 * Two modes. `modal` gets a scrim, takes focus, and traps it loosely; the
 * default non-modal mode has no scrim, leaves focus on the trigger, and dismisses
 * on outside-press, Escape, or trigger blur. For a screen-anchored modal use
 * `Dialog`; for a bottom sheet use the sheet species.
 */
export interface PopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The anchor the overlay is positioned against. */
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  open?: boolean;
  /** Called on Escape, outside-press, and (non-modal) trigger blur. */
  onDismiss?: () => void;
  /** Scrim + focus when true; focus-inert when false (the default). */
  modal?: boolean;
  /** Preferred side; flips to stay on-screen. */
  side?: 'bottom' | 'top';
  /** Which trigger edge the panel lines up with: left (start) or right (end). Default start. */
  align?: 'start' | 'end';
  style?: React.CSSProperties;
}
export declare function Popover(props: PopoverProps): JSX.Element;
