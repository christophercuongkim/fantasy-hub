"""Yahoo Fantasy API client.

Transparently refreshes the access token, retries once on 401, and surfaces
Yahoo's undocumented 999 rate-limit signal. Reads the token stored by the web
OAuth flow (see docs/05-yahoo-api-cookbook.md §1.3).
"""

import base64
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.config import settings
from app.yahoo import tokens

BASE = "https://fantasysports.yahooapis.com/fantasy/v2"
TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token"
REFRESH_SKEW = timedelta(seconds=60)


class YahooError(RuntimeError):
    pass


class YahooRateLimited(YahooError):
    """Yahoo returned HTTP 999 — back off exponentially."""


class YahooClient:
    def __init__(self) -> None:
        if not settings.yahoo_client_id or not settings.yahoo_client_secret:
            raise RuntimeError("YAHOO_CLIENT_ID / YAHOO_CLIENT_SECRET not set")
        if not settings.token_enc_key:
            raise RuntimeError("TOKEN_ENC_KEY not set")
        self._access: str | None = None
        self._refresh: str | None = None
        self._expires_at: datetime | None = None

    def _redirect_uri(self) -> str:
        return f"{settings.app_base_url}/api/auth/yahoo/callback"

    def _load(self) -> None:
        stored = tokens.load()
        if stored is None:
            raise YahooError("no Yahoo token stored — complete the OAuth flow first")
        self._access = stored.access_token
        self._refresh = stored.refresh_token
        self._expires_at = stored.expires_at

    def _ensure_token(self) -> None:
        if self._access is None:
            self._load()
        assert self._expires_at is not None
        if self._expires_at <= datetime.now(UTC) + REFRESH_SKEW:
            self._do_refresh()

    def _do_refresh(self) -> None:
        basic = base64.b64encode(
            f"{settings.yahoo_client_id}:{settings.yahoo_client_secret}".encode()
        ).decode()
        resp = httpx.post(
            TOKEN_URL,
            headers={"Authorization": f"Basic {basic}"},
            data={
                "grant_type": "refresh_token",
                "redirect_uri": self._redirect_uri(),
                "refresh_token": self._refresh,
            },
            timeout=20,
        )
        if resp.status_code != 200:
            raise YahooError(f"token refresh failed {resp.status_code}: {resp.text}")
        body = resp.json()
        self._access = body["access_token"]
        self._expires_at = datetime.now(UTC) + timedelta(
            seconds=body.get("expires_in", 3600)
        )
        tokens.save_access_token(self._access, self._expires_at)

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self._ensure_token()
        query = {**(params or {}), "format": "json"}
        for attempt in range(2):
            resp = httpx.get(
                f"{BASE}{path}",
                headers={"Authorization": f"Bearer {self._access}"},
                params=query,
                timeout=30,
            )
            if resp.status_code == 401 and attempt == 0:
                self._do_refresh()
                continue
            if resp.status_code == 999:
                raise YahooRateLimited("Yahoo rate limit (HTTP 999) — back off")
            if resp.status_code != 200:
                raise YahooError(f"Yahoo {path} -> {resp.status_code}: {resp.text}")
            return resp.json()
        raise YahooError("unreachable")
