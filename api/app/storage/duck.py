"""DuckDB access to the Parquet cold tier.

DuckDB queries Parquet files directly with no import step — the aggregation
pipeline (Phase 1) and backtests (Phase 2) run as DuckDB SQL over these files.
"""

from collections.abc import Iterator
from contextlib import contextmanager

import duckdb


@contextmanager
def connect() -> Iterator[duckdb.DuckDBPyConnection]:
    """In-memory DuckDB connection. Parquet files are read by path, so no
    persistent database is needed."""
    con = duckdb.connect(database=":memory:")
    try:
        yield con
    finally:
        con.close()


def ping() -> bool:
    with connect() as con:
        row = con.execute("SELECT 1").fetchone()
        return row is not None and row[0] == 1
