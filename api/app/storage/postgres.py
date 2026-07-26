"""Postgres (Neon) access for the api service.

Writes use batched COPY, never row-by-row INSERT — with Postgres across the
network a per-row pipeline collapses on real volumes (implementation plan §5.5).
"""

from collections.abc import Iterable, Sequence
from typing import Any

import psycopg

from app.config import settings


def _require_url() -> str:
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not set")
    return settings.database_url


def connect() -> psycopg.Connection:
    """A new Postgres connection. Caller manages the lifecycle (use as a context
    manager). One connection per job, not one per table (compute-hours)."""
    return psycopg.connect(_require_url())


def ping() -> bool:
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1")
        row = cur.fetchone()
        return row is not None and row[0] == 1


def copy_rows(
    conn: psycopg.Connection,
    table: str,
    columns: Sequence[str],
    rows: Iterable[Sequence[Any]],
) -> int:
    """Batched COPY of rows into table(columns). Returns the row count.

    Runs inside the caller's transaction so a failed batch rolls back cleanly.
    """
    col_list = ", ".join(f'"{c}"' for c in columns)
    count = 0
    with conn.cursor() as cur:
        with cur.copy(f"COPY {table} ({col_list}) FROM STDIN") as copy:
            for row in rows:
                copy.write_row(row)
                count += 1
    return count
