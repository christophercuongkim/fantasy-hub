import * as React from 'react';

export interface IconProps extends React.HTMLAttributes<HTMLElement> {
  /** Phosphor icon name, kebab-case, without the `ph-` prefix. e.g. "map-pin" */
  name: string;
  /** regular for UI, fill for active state, bold under 14px, duotone for empty states + slides. */
  weight?: 'regular' | 'bold' | 'fill' | 'duotone';
  /** 14 | 16 | 20 | 24 */
  size?: number;
  /** Omit — icons should inherit currentColor. */
  color?: string;
}
export declare function Icon(props: IconProps): JSX.Element;
