import { auth, isAdmin } from "@/auth";

// Public: only the landing, login, and the NextAuth endpoints. Everything else —
// including the hall of records — requires sign-in (any Google account). Admin
// areas (/admin/*, /projections, /matchup) additionally require an admin
// (ADMIN_EMAILS) — non-admins bounce to the landing.
const ADMIN_PREFIXES = [
  "/admin",
  "/projections",
  "/matchup",
  "/draft-assistant",
  "/keeper",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/api/auth");
  if (isPublic) return;

  if (!req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  const adminOnly = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  if (adminOnly && !isAdmin(req.auth.user?.email)) {
    return Response.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
