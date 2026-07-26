"""Read/refresh the Yahoo token row written by the web OAuth callback."""

from dataclasses import dataclass
from datetime import datetime

from app.storage import postgres
from app.yahoo import crypto

ROW_ID = "default"


@dataclass
class StoredToken:
    access_token: str
    refresh_token: str
    expires_at: datetime
    guid: str | None


def load() -> StoredToken | None:
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT access_token_enc, refresh_token_enc, expires_at, guid "
            "FROM yahoo_tokens WHERE id = %s",
            (ROW_ID,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return StoredToken(
        access_token=crypto.decrypt(row[0]),
        refresh_token=crypto.decrypt(row[1]),
        expires_at=row[2],
        guid=row[3],
    )


def save_access_token(access_token: str, expires_at: datetime) -> None:
    """Persist a refreshed access token (the refresh token is unchanged)."""
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE yahoo_tokens "
            "SET access_token_enc = %s, expires_at = %s, updated_at = now() "
            "WHERE id = %s",
            (crypto.encrypt(access_token), expires_at, ROW_ID),
        )
        conn.commit()
