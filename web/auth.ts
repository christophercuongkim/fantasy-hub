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
  // Behind Traefik (TLS terminated at the proxy) Auth.js must trust the
  // X-Forwarded-Host/Proto headers to build callback + redirect URLs from the
  // public origin. Without this it defaults to the internal container host and
  // fails the OAuth flow with error=Configuration. Same class as the Yahoo
  // req.url redirect bug (tasks/lessons.md) — never derive external URLs from
  // the internal request. AUTH_URL pins the origin per deployment as backup.
  trustHost: true,
  providers: [Google],
  pages: { signIn: "/login" },
});
