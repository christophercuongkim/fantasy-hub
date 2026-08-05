import * as React from 'react';

/**
 * A person, team, or account. Falls back to initials when no image is supplied.
 * One of the only circular shapes in a square system — see tokens/radius.css.
 */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Used for initials and the title tooltip. */
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Corner dot. `live` = playing/active, `out` = unavailable, `idle` = neutral. */
  status?: 'live' | 'out' | 'idle';
  style?: React.CSSProperties;
}
export declare function Avatar(props: AvatarProps): JSX.Element;
