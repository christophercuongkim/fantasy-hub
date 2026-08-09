"""Player-name normalization — the single source of truth for name matching.

Kept dependency-free (no nfl_data_py) so both the crosswalk builder and the
Yahoo roster sync can normalize on identical terms without pulling the heavy
ingest stack. If the rules drift, name matching silently diverges — so there is
exactly one `normalize`.
"""

from __future__ import annotations

import re

_SUFFIX = {"jr", "sr", "ii", "iii", "iv", "v"}


def normalize(name: str) -> str:
    """Lowercase, drop punctuation + generational suffixes, collapse spaces.
    Applied to both sides so draft/roster names and registry names compare on
    equal terms."""
    n = re.sub(r"[.'`]", "", name.lower())
    n = re.sub(r"[-]", " ", n)
    toks = [t for t in re.split(r"\s+", n) if t and t not in _SUFFIX]
    return " ".join(toks).strip()
