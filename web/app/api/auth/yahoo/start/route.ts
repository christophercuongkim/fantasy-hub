import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/yahoo/oauth";

// Kick off the OAuth flow: mint a CSRF state, stash it in an httpOnly cookie,
// and redirect the browser to Yahoo's consent screen.
export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("yahoo_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
