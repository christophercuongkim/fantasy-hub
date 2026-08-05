import * as React from 'react';

/**
 * Bordered surface. Flat at rest — a card never casts a shadow.
 * @startingPoint section="Core" subtitle="Bordered surface with eyebrow, title, media, footer" viewport="700x300"
 */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  children?: React.ReactNode;
  /** Mono all-caps kicker, e.g. "NONSTOP · TAP AIR". */
  eyebrow?: string;
  title?: React.ReactNode;
  /** One line of supporting copy under the title. */
  meta?: React.ReactNode;
  /** Rendered flush above the padded body — put an <img> here, 0px radius, edge to edge. */
  media?: React.ReactNode;
  /** Divided action row at the bottom. */
  footer?: React.ReactNode;
  /** Adds hover response and a pointer cursor. */
  interactive?: boolean;
  /** Accent border + tinted surface. */
  selected?: boolean;
  padding?: string;
  style?: React.CSSProperties;
}
export declare function Card(props: CardProps): JSX.Element;
