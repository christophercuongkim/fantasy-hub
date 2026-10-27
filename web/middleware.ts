import { auth, isAdmin } from "@/auth";
import { NextResponse } from "next/server";

// Public: login + NextAuth endpoints. Authenticated `/` redirects to HoR in the
// page. Admin areas additionally require ADMIN_EMAILS — non-admins bounce to HoR.
const ADMIN_PREFIXES = [
  "/admin",
  "/projections",
  "/matchup",
  "/draft-assistant",
  "/keeper",
  "/more",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/login" || pathname.startsWith("/api/auth");

  if (pathname === "/" && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublic) {
    if (req.auth && pathname === "/login") {
      return NextResponse.redirect(new URL("/hall_of_records", req.nextUrl));
    }
    return;
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  const adminOnly = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  if (adminOnly && !isAdmin(req.auth.user?.email)) {
    return NextResponse.redirect(new URL("/hall_of_records", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
