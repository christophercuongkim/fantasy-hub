import Link from "next/link";
import { Card } from "@seakim/design-system";
import { auth, isAdmin } from "@/auth";

// Landing — the only page visible signed out. In-app links appear once there's
// a session (everything but this page requires sign-in; /admin is admin-only).
export default async function Home() {
  const session = await auth();
  const admin = isAdmin(session?.user?.email);

  return (
    <main
      style={{
        maxWidth: "40rem",
        minHeight: "100vh",
        margin: "0 auto",
        padding: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "var(--space-6)",
      }}
    >
      <div>
        <h1
          style={{
            font: "600 var(--text-5xl) var(--font-display)",
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          fantasy-hub
        </h1>
        <p
          style={{
            marginTop: "var(--space-2)",
            color: "var(--text-secondary)",
          }}
        >
          Personal NFL fantasy analytics.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)" }}>
        {session && (
          <NavCard
            href="/hall_of_records"
            eyebrow="LEAGUE"
            title="Hall of Records"
            meta="Records, superlatives, head-to-head"
          />
        )}
        {admin && (
          <NavCard
            href="/admin/crosswalk"
            eyebrow="ADMIN"
            title="Player crosswalk"
            meta="Review Yahoo ↔ nflverse matches"
          />
        )}
        {!session && (
          <NavCard
            href="/login"
            eyebrow="ACCESS"
            title="Sign in"
            meta="A Google account is required"
          />
        )}
      </div>
    </main>
  );
}

function NavCard({
  href,
  eyebrow,
  title,
  meta,
}: {
  href: string;
  eyebrow: string;
  title: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      style={{ textDecoration: "none", color: "inherit", flex: "1 1 14rem" }}
    >
      <Card interactive eyebrow={eyebrow} title={title} meta={meta} />
    </Link>
  );
}
