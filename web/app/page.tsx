import Link from "next/link";
import { auth, isAdmin } from "@/auth";

// Public landing — the only page you can see signed out. Everything else,
// including the Hall of Records, requires sign-in; /admin is admin-only (see
// middleware). So the in-app links show only once there's a session.
export default async function Home() {
  const session = await auth();
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">fantasy-hub</h1>
        <p className="mt-2 text-neutral-500">Personal NFL fantasy analytics.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {session && (
          <Link
            href="/hall_of_records"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            League Hall of Records →
          </Link>
        )}
        {isAdmin(session?.user?.email) && (
          <Link
            href="/admin/crosswalk"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Admin
          </Link>
        )}
        {!session && (
          <Link
            href="/login"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Sign in
          </Link>
        )}
      </div>
    </main>
  );
}
