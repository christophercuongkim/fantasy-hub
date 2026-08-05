import { Outfit, Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";

/**
 * Self-hosted at build time, assigned to the same CSS variables the design system
 * already reads (--font-display / --font-sans / --font-mono). Because the variable
 * names match, no component or token file changes. The Google @import was stripped
 * from the vendored tokens/fonts.css (see web/scripts/vendor-seakim.sh) so the
 * families aren't also fetched from Google at runtime.
 *
 * Weights are pinned to what the system actually uses.
 */
export const fontDisplay = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-sans",
  display: "swap",
});

export const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const fontVariables = [
  fontDisplay.variable,
  fontSans.variable,
  fontMono.variable,
].join(" ");
