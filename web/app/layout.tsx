import type { Metadata } from "next";
import { auth, signOut } from "@/auth";

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
/** System default; a first-time visitor sees no flash. */
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
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
      <body>
        {session && (
          <div
            style={{
              position: "fixed",
              top: "var(--space-3)",
              right: "var(--space-3)",
              zIndex: 50,
            }}
          >
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                style={{
                  font: "var(--text-xs) var(--font-mono)",
                  color: "var(--text-secondary)",
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-1) var(--space-3)",
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
