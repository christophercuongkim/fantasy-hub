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

// Pin the public origin for Auth.js from our existing APP_BASE_URL. Behind
// Traefik (TLS terminated at the proxy) Auth.js otherwise builds callback +
// redirect URLs from the internal container host (https://<container-id>:4000),
// which the browser can't resolve — the OAuth flow dies at
// /api/auth/error?error=Configuration. Auth.js only reads AUTH_URL, so bridge
// our one origin var to it rather than duplicating the value. trustHost lets it
// accept the proxied request host. Same class as the Yahoo req.url redirect bug
// (tasks/lessons.md): never derive external URLs from the internal request.
if (process.env.APP_BASE_URL && !process.env.AUTH_URL) {
  process.env.AUTH_URL = process.env.APP_BASE_URL;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google],
  pages: { signIn: "/login" },
});
