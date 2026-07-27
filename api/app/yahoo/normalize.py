"""Primitives for turning Yahoo's XML-derived JSON into clean values.

Yahoo returns objects keyed by stringified integers with a sibling `count`, and
interleaves metadata arrays with sub-collections. Every parser builds on these
helpers. See docs/05-yahoo-api-cookbook.md §2.
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

_EASTERN = ZoneInfo("America/New_York")


def flatten_meta(arr: Any) -> dict[str, Any]:
    """[{a:1},{b:2}] -> {a:1, b:2}. Passes a dict through unchanged."""
    if isinstance(arr, dict):
        return arr
    out: dict[str, Any] = {}
    if isinstance(arr, list):
        for item in arr:
            if isinstance(item, dict):
                out.update(item)
    return out


def iter_collection(obj: Any) -> Iterator[Any]:
    """Yield values from a Yahoo integer-keyed collection, skipping `count`.

    Handles both `{"count": 0}` and a missing/empty collection (yields nothing).
    """
    if not isinstance(obj, dict):
        return
    for key, value in obj.items():
        if key == "count":
            continue
        yield value


def coerce_int(value: Any) -> int | None:
    """'12' -> 12. None/'' -> None. The coercion that bites hardest if skipped."""
    if value is None or value == "":
        return None
    return int(value)


def coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def normalize_status(status: Any) -> str | None:
    """Roster status: null/'' -> None (healthy). Otherwise the code (Q/D/O/...)."""
    if status in (None, "", "null"):
        return None
    return str(status)


def split_positions(display_position: Any) -> list[str]:
    """'WR,RB' -> ['WR','RB']; '' -> []."""
    if not display_position:
        return []
    return [p.strip() for p in str(display_position).split(",") if p.strip()]


def eastern_to_utc(value: str) -> datetime:
    """Yahoo timestamps are US Eastern with no tz marker. Convert to aware UTC."""
    naive = datetime.fromisoformat(value)
    if naive.tzinfo is not None:
        return naive.astimezone(UTC)
    return naive.replace(tzinfo=_EASTERN).astimezone(UTC)
