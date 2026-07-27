"""One-time league bootstrap.

    python -m app.bootstrap [config_dir]

Reads league.yaml + draft-*.csv from config_dir (default ./bootstrap) and loads
them into Postgres. Requires DATABASE_URL. See bootstrap/*.example.* for format.
"""

import sys
from pathlib import Path

from app.bootstrap.load import load


def main() -> int:
    config_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("bootstrap")
    if not (config_dir / "league.yaml").is_file():
        print(f"no league.yaml in {config_dir}", file=sys.stderr)
        return 1
    result = load(config_dir)
    print(
        f"Loaded league {result['league_id']}: {result['teams']} teams, "
        f"{result['picks']} picks across seasons {result['seasons']}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
