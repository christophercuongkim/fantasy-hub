import { auth, isAdmin } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { chromeSeasons } from "@/lib/chrome-seasons";

export const dynamic = "force-dynamic";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Middleware already requires auth for (shell) routes; belt-and-braces.
  if (!session) return children;

  const admin = isAdmin(session.user?.email);
  let seasons: number[] = [];
  try {
    seasons = await chromeSeasons();
  } catch {
    // DB may be cold on first paint; season chrome simply hides.
    seasons = [];
  }

  return (
    <AppShell admin={admin} seasons={seasons}>
      {children}
    </AppShell>
  );
}
