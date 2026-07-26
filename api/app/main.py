from fastapi import FastAPI

app = FastAPI(title="fantasy-hub-api", version="0.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe.

    Subsystem checks (postgres, parquet_root, duckdb) are added as those
    layers land — see docs/02-api-contract.md. Dokploy's healthcheck hits this.
    """
    return {"status": "ok", "version": app.version}
