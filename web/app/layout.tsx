import type { Metadata } from "next";

// Global CSS is only legal in the root layout. The design system's token +
// component styles first, then our app globals (Tailwind utilities during the
// migration + the d3 chart CSS).
import "@seakim/design-system/styles.css";
import "@phosphor-icons/web/regular/style.css";
import "@phosphor-icons/web/bold/style.css";
import "@phosphor-icons/web/fill/style.css";
import "./globals.css";

import { fontVariables } from "./fonts";

/** Which app's accent is live — the fantasy-sport "bench" kit (turf, hue 145). */
const APP = "bench";
/** System default; a first-time visitor sees no flash. Kept dark (CHR-567 / 3A). */
const DEFAULT_THEME = "dark";

export const metadata: Metadata = {
  title: "fantasy-hub",
  description: "Personal NFL fantasy analytics",
};

// Runs before first paint so a returning visitor who chose light does not see a
// dark frame first. The only inline script in the app — the server can't read
// localStorage. Wrapped in try/catch so blocked storage leaves the default.
const noFlashScript = `
(function () {
  try {
    var t = localStorage.getItem('sk-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the no-flash script may change data-theme before
    // React hydrates, and that difference is expected.
    <html
      lang="en"
      data-app={APP}
      data-theme={DEFAULT_THEME}
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
