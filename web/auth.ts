import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Anyone with a Google account can sign in (league members, for future
// features). Admin capabilities are gated separately by isAdmin / middleware.
const admins = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(email?: string | null): boolean {
  return !!email && admins.includes(email.toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login" },
});
