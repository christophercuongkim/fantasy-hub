"""Thin Postgres connection for the loader. No coupling to the api service —
the loader writes raw SQL against the web/drizzle schema; it only needs a
DATABASE_URL (prod Neon, or a preview branch for a dry run)."""

from __future__ import annotations

import os

import psycopg


def connect() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set (point at Neon or a preview branch)")
    return psycopg.connect(url)
