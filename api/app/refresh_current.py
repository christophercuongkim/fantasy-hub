"""Weekly projection refresh, runnable as `python -m app.refresh_current`.

The Dokploy scheduled task calls this in-process rather than curling the HTTP
endpoint: the api image is a slim Python base with no curl, an in-container module
run needs no network round-trip, and it hands the scheduler a clean exit code.
Same work as POST /jobs/refresh-current.
"""

import json
import sys

from app.projection import baseline


def main() -> int:
    result = baseline.refresh_current()
    print(json.dumps(result, default=str))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001 — surface any failure as a non-zero exit
        print(f"refresh-current failed: {e}", file=sys.stderr)
        sys.exit(1)
