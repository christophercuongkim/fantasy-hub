import { auth, isAdmin } from "@/auth";

// Public: landing, login, the shareable hall of records, the NextAuth endpoints.
// Everything else requires sign-in (any Google account). /admin/* additionally
// requires an admin (ADMIN_EMAILS) — non-admins bounce to the landing.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/hall_of_records") ||
    pathname.startsWith("/api/auth");
  if (isPublic) return;

  if (!req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  if (pathname.startsWith("/admin") && !isAdmin(req.auth.user?.email)) {
    return Response.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
