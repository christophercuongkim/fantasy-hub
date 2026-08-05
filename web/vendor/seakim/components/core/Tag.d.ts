import * as React from 'react';

/** Interactive chip: filters, applied criteria, roster positions. Read-only status is Badge. */
export interface TagProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'style' | 'onClick'> {
  children?: React.ReactNode;
  icon?: string;
  /** Accent border + tint; the icon switches to fill weight. */
  selected?: boolean;
  /** Adds a trailing × button. Omit for non-removable tags. */
  onRemove?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function Tag(props: TagProps): JSX.Element;
