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
  // Behind Traefik (TLS terminated at the proxy) Auth.js otherwise builds
  // callback + redirect URLs from the internal container host
  // (https://<container-id>:4000), which the browser can't resolve — the OAuth
  // flow dies at /api/auth/error?error=Configuration. trustHost lets it accept
  // the proxied request host; the public origin is pinned by the AUTH_URL env
  // var (must be set per deployment — mutating process.env here is too late,
  // next-auth reads AUTH_URL at import, before this module body runs). Same
  // class as the Yahoo req.url redirect bug (tasks/lessons.md).
  trustHost: true,
  providers: [Google],
  pages: { signIn: "/login" },
});
