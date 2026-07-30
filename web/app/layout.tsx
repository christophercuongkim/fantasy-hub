import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "fantasy-hub",
  description: "Personal NFL fantasy analytics",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        {session && (
          <div className="fixed right-3 top-3 z-50">
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="rounded-md border border-neutral-200 bg-white/80 px-2 py-1 text-xs text-neutral-500 backdrop-blur hover:text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/80">
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
