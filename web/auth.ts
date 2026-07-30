import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Single-admin gate: only allowlisted Google accounts may sign in. ADMIN_EMAILS
// is a comma-separated list (set in the web app env). Fail closed if unset.
const allowed = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      return !!email && allowed.includes(email);
    },
  },
});
