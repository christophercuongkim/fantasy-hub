import * as React from 'react';

/** Square icon-only button. `label` is required — it becomes aria-label and the tooltip. */
export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  /** Phosphor icon name. */
  icon: string;
  /** Accessible name. Required. */
  label: string;
  variant?: 'ghost' | 'secondary';
  /** lg is 44px — use it on mobile. */
  size?: 'sm' | 'md' | 'lg';
  /** Toggled/selected — switches the glyph to fill weight and tints it. */
  active?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
