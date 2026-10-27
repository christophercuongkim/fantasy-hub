import Link from "next/link";
import { PageBody, PageHeader } from "@seakim/design-system";
import { auth, isAdmin } from "@/auth";
import { redirect } from "next/navigation";

/** Phone "More" tab — tools + admin destinations that don't fit the TabBar. */
export default async function MorePage() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) redirect("/hall_of_records");

  const links = [
    { href: "/draft-assistant", label: "Draft assistant", meta: "Value board" },
    { href: "/keeper", label: "Keeper valuator", meta: "Keep vs pick cost" },
    { href: "/projections", label: "Projections", meta: "Weekly baseline" },
    { href: "/admin/yahoo", label: "Yahoo sync", meta: "Cookie + league sync" },
    {
      href: "/admin/crosswalk",
      label: "Player crosswalk",
      meta: "Yahoo ↔ nflverse",
    },
  ];

  return (
    <PageBody width="list">
      <PageHeader
        title="More"
        description="Tools and admin — also in the side nav on desktop."
      />
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
        }}
      >
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)",
                padding: "var(--space-4)",
                textDecoration: "none",
                color: "inherit",
                background: "var(--surface-card)",
                borderRadius: "var(--radius-xl)",
              }}
            >
              <span
                style={{
                  font: "var(--type-body)",
                  color: "var(--text-primary)",
                }}
              >
                {l.label}
              </span>
              <span
                style={{
                  font: "var(--type-caption)",
                  color: "var(--text-secondary)",
                }}
              >
                {l.meta}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageBody>
  );
}
