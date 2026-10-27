import * as React from 'react';

/** One person in a stack — the same fields `Avatar` takes. */
export interface AvatarStackItem {
  name?: string;
  src?: string;
  status?: 'live' | 'out' | 'idle';
}

/**
 * More than one avatar in one place: overlaps them, caps the count at `max`, and
 * collapses the remainder into a "+k" count pill. For a single person use `Avatar`.
 * See decision 0024 and spec/AvatarStack.md.
 */
export interface AvatarStackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** People to show, front-most first. */
  items: AvatarStackItem[];
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Visible avatars before the remainder collapses to a "+k" pill. A remainder
   *  of exactly one shows the avatar instead of "+1". */
  max?: number;
  /** First avatar on top (default), or last. Not a reading-order assumption. */
  frontToBack?: boolean;
  style?: React.CSSProperties;
}
export declare function AvatarStack(props: AvatarStackProps): JSX.Element;
