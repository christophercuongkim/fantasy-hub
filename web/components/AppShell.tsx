"use client";

import { Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SideNav, TabBar, useWindowBreakpoint } from "@seakim/design-system";
import { ChromeSeason } from "@/components/ChromeSeason";
import { LeagueSlotStub } from "@/components/LeagueSlotStub";
import { SignOutButton } from "@/components/SignOutButton";

type NavItem = {
  value: string;
  label: string;
  icon: string;
  href: string;
  admin?: boolean;
};

const LEAGUE_ITEMS: NavItem[] = [
  {
    value: "/hall_of_records",
    label: "Hall of Records",
    icon: "trophy",
    href: "/hall_of_records",
  },
  {
    value: "/draft",
    label: "Draft",
    icon: "list-numbers",
    href: "/draft",
  },
];

const TOOL_ITEMS: NavItem[] = [
  {
    value: "/matchup",
    label: "Matchup",
    icon: "football",
    href: "/matchup",
    admin: true,
  },
  {
    value: "/draft-assistant",
    label: "Draft assistant",
    icon: "lightning",
    href: "/draft-assistant",
    admin: true,
  },
  {
    value: "/keeper",
    label: "Keeper",
    icon: "lock-simple",
    href: "/keeper",
    admin: true,
  },
  {
    value: "/projections",
    label: "Projections",
    icon: "chart-line",
    href: "/projections",
    admin: true,
  },
];

const ADMIN_ITEMS: NavItem[] = [
  {
    value: "/admin/yahoo",
    label: "Yahoo sync",
    icon: "arrows-clockwise",
    href: "/admin/yahoo",
    admin: true,
  },
  {
    value: "/admin/crosswalk",
    label: "Crosswalk",
    icon: "git-merge",
    href: "/admin/crosswalk",
    admin: true,
  },
];

function activeValue(pathname: string): string {
  const all = [
    ...LEAGUE_ITEMS,
    ...TOOL_ITEMS,
    ...ADMIN_ITEMS,
    { value: "/more" },
  ];
  const hit = all.find(
    (i) => pathname === i.value || pathname.startsWith(`${i.value}/`),
  );
  return hit?.value ?? pathname;
}

export function AppShell({
  admin,
  seasons,
  children,
}: {
  admin: boolean;
  seasons: number[];
  children: React.ReactNode;
}) {
  const bp = useWindowBreakpoint();
  const pathname = usePathname();
  const router = useRouter();
  const sm = bp === "sm";
  const collapsed = bp === "md";
  const active = activeValue(pathname);

  const leagueGroup = {
    label: "League",
    items: LEAGUE_ITEMS.map(({ value, label, icon, href }) => ({
      value,
      label,
      icon,
      href,
    })),
  };

  const toolItems = TOOL_ITEMS.filter((i) => admin || !i.admin).map(
    ({ value, label, icon, href }) => ({ value, label, icon, href }),
  );
  const adminItems = ADMIN_ITEMS.filter((i) => admin || !i.admin).map(
    ({ value, label, icon, href }) => ({ value, label, icon, href }),
  );

  const groups = [
    leagueGroup,
    ...(toolItems.length ? [{ label: "Tools", items: toolItems }] : []),
    ...(adminItems.length ? [{ label: "Admin", items: adminItems }] : []),
  ];

  // TabBar: 3–5 destinations. Non-admins get Records + Draft; admins add
  // Matchup + More (tools/admin).
  const tabItems = admin
    ? [
        { value: "/hall_of_records", label: "Records", icon: "trophy" },
        { value: "/draft", label: "Draft", icon: "list-numbers" },
        { value: "/matchup", label: "Matchup", icon: "football" },
        { value: "/more", label: "More", icon: "dots-three-outline" },
      ]
    : [
        { value: "/hall_of_records", label: "Records", icon: "trophy" },
        { value: "/draft", label: "Draft", icon: "list-numbers" },
      ];

  const railWidth = collapsed
    ? "var(--sidebar-w-collapsed, 56px)"
    : "var(--sidebar-w, 232px)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "var(--surface-page)",
        color: "var(--text-primary)",
      }}
    >
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {!sm && (
          <aside
            style={{
              width: railWidth,
              flex: "none",
              display: "flex",
              flexDirection: "column",
              height: "100dvh",
              position: "sticky",
              top: 0,
              background: "var(--surface-card)",
            }}
          >
            {/* SideNav header slot: brand + league stub (CHR-125) + season */}
            <div
              style={{
                flex: "none",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                padding: collapsed
                  ? "var(--space-4) 0"
                  : "var(--space-4) var(--space-5)",
                alignItems: collapsed ? "center" : "stretch",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: collapsed ? "var(--text-md)" : "var(--text-lg)",
                  fontWeight: "var(--weight-medium)",
                  letterSpacing: "var(--tracking-tight)",
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
                title="fantasy-hub"
              >
                {collapsed ? "f" : "fantasy-hub"}
              </div>
              {!collapsed && (
                <>
                  <LeagueSlotStub />
                  <Suspense fallback={null}>
                    <ChromeSeason seasons={seasons} />
                  </Suspense>
                </>
              )}
            </div>
            <SideNav
              groups={groups}
              active={active}
              collapsed={collapsed}
              footer={<SignOutButton collapsed={collapsed} />}
              style={{
                width: "100%",
                flex: 1,
                minHeight: 0,
                background: "transparent",
              }}
            />
          </aside>
        )}

        <main
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            // Tab bar clearance on phone
            paddingBottom: sm ? "var(--tabbar-h, 56px)" : undefined,
          }}
        >
          {children}
        </main>
      </div>

      {sm && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
          }}
        >
          <TabBar
            items={tabItems}
            active={
              tabItems.some((t) => t.value === active)
                ? active
                : admin &&
                    (TOOL_ITEMS.some((t) => t.value === active) ||
                      ADMIN_ITEMS.some((t) => t.value === active))
                  ? "/more"
                  : active
            }
            onChange={(value: string) => router.push(value)}
          />
        </div>
      )}
    </div>
  );
}
