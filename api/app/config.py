from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Postgres (Neon) — optional so the service still boots and /health can report
    # its state. Jobs that write to Postgres fail loudly if it's unset.
    database_url: str | None = None

    # Root of the Parquet/DuckDB cold tier. Bind-mounted (/srv/fantasy -> /data).
    parquet_root: str = "/data"


settings = Settings()
