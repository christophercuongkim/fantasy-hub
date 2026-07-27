// Yahoo OAuth2 endpoints and token exchange. See docs/05-yahoo-api-cookbook.md §1.2.

const AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function redirectUri(): string {
  // Must match the Redirect URI registered at Yahoo exactly.
  return `${required("APP_BASE_URL")}/api/auth/yahoo/callback`;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: required("YAHOO_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    // Fantasy Sports read scope — without it the token has NO Fantasy access and
    // every call 401s with oauth_problem="additional_authorization_required".
    // Yahoo grants Fantasy via this scope param, not via an app-permission checkbox.
    scope: "fspt-r",
    language: "en-us",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  xoauth_yahoo_guid?: string;
};

async function tokenRequest(
  body: Record<string, string>,
): Promise<TokenResponse> {
  const basic = Buffer.from(
    `${required("YAHOO_CLIENT_ID")}:${required("YAHOO_CLIENT_SECRET")}`,
  ).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    throw new Error(`Yahoo token endpoint ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(code: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  });
}

export function refresh(refreshToken: string): Promise<TokenResponse> {
  // redirect_uri is required on refresh too, even though nothing redirects.
  return tokenRequest({
    grant_type: "refresh_token",
    redirect_uri: redirectUri(),
    refresh_token: refreshToken,
  });
}
