import * as React from 'react';

/** layout.md's content ceilings: `list` 48rem (single-column lists and feeds), `form` 620px, `prose` 68ch, `full`. */
export type PageWidth = 'list' | 'form' | 'prose' | 'full';

/**
 * The body of a page inside the shell's main area: `pagePad(bp)` for the measured
 * breakpoint outside, the `width` ceiling inside, the column centred. Does not scroll.
 */
export interface PageBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  width: PageWidth;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function PageBody(props: PageBodyProps): JSX.Element;

/** layout.md page padding for a breakpoint, as a CSS `padding` value. */
export declare function pagePad(bp: 'sm' | 'md' | 'lg'): string;
