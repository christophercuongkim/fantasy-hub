"""Read/write the encrypted Yahoo session-cookie header (for pub-api-rw).

Mirrors tokens.py: a single row keyed by a constant id, AES-256-GCM at rest with
the same TOKEN_ENC_KEY the web service holds (so the admin form can write it and
the api can read it). Pasted from a logged-in browser request; re-pasted when
Yahoo expires it.
"""

from app.storage import postgres
from app.yahoo import crypto

ROW_ID = "default"


def load() -> str | None:
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT cookie_enc FROM yahoo_cookies WHERE id = %s", (ROW_ID,))
        row = cur.fetchone()
    return crypto.decrypt(row[0]) if row else None


def save(cookie: str) -> None:
    with postgres.connect() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO yahoo_cookies (id, cookie_enc, updated_at) "
            "VALUES (%s, %s, now()) "
            "ON CONFLICT (id) DO UPDATE "
            "SET cookie_enc = EXCLUDED.cookie_enc, updated_at = now()",
            (ROW_ID, crypto.encrypt(cookie)),
        )
        conn.commit()
