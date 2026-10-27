import { Instrument_Sans, JetBrains_Mono } from "next/font/google";

/**
 * Self-hosted at build time, assigned to the CSS variables the design system
 * already reads (--font-display / --font-sans / --font-mono). Because the
 * variable names match, no component or token file changes. The Google @import
 * was stripped from the vendored tokens/fonts.css (see web/scripts/vendor-seakim.sh)
 * so the families aren't also fetched from Google at runtime.
 *
 * SeaKim 0031: Instrument Sans for every word; JetBrains Mono for data. Display
 * and sans share one face — --font-display stays a named slot (wordmark /
 * headings) pointing at the same family.
 */
export const fontSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-sans",
  display: "swap",
});

/** Same face as sans; separate CSS var so the display slot stays one-edit reversible. */
export const fontDisplay = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const fontMono = JetBrains_Mono({
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
