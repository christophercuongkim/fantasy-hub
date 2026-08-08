import { YahooSync } from "./YahooSync";

// Admin-only (gated by middleware /admin prefix). Paste the logged-in Yahoo
// cookie header, then sync a league's teams from pub-api-rw.
export const dynamic = "force-dynamic";

export default function YahooAdmin() {
  return (
    <main
      style={{
        maxWidth: "48rem",
        margin: "0 auto",
        padding: "var(--space-8) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <div>
        <h1 style={{ font: "var(--type-title)", color: "var(--text-primary)" }}>
          Yahoo sync
        </h1>
        <p
          style={{
            marginTop: "var(--space-1)",
            font: "var(--type-body-sm)",
            color: "var(--text-secondary)",
          }}
        >
          Paste your logged-in Yahoo cookie header (DevTools → a{" "}
          <code>pub-api-rw</code> request → Copy → Copy as cURL → the{" "}
          <code>Cookie:</code> value), save it, then sync a league&rsquo;s
          teams. Re-paste when a sync returns a 401.
        </p>
      </div>
      <YahooSync />
    </main>
  );
}
