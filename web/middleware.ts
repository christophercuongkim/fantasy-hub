import { auth } from "@/auth";

// Public routes: the landing page, login, the shareable hall of records, and
// the NextAuth endpoints. Everything else requires a signed-in (allowlisted)
// admin — unauthenticated requests are redirected to /login.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/hall_of_records") ||
    pathname.startsWith("/api/auth");
  if (!isPublic && !req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

// Skip Next internals and static files.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
