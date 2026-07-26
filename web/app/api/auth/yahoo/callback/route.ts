import { type NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/yahoo/oauth";
import { saveToken } from "@/lib/yahoo/tokens";

// Yahoo redirects here with ?code&state. Verify the state against the cookie,
// exchange the code for tokens, store them (encrypted), and bounce home.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("yahoo_oauth_state")?.value;

  if (!code) {
    return NextResponse.json(
      { error: "missing authorization code" },
      { status: 400 },
    );
  }
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: "state mismatch" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCode(code);
    await saveToken(tokens);
  } catch {
    return NextResponse.json(
      { error: "token exchange failed" },
      { status: 502 },
    );
  }

  const res = NextResponse.redirect(new URL("/?yahoo=connected", req.url));
  res.cookies.delete("yahoo_oauth_state");
  return res;
}
