from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Postgres (Neon) — optional so the service still boots and /health can report
    # its state. Jobs that write to Postgres fail loudly if it's unset.
    database_url: str | None = None

    # Root of the Parquet/DuckDB cold tier. Bind-mounted (/srv/fantasy -> /data).
    parquet_root: str = "/data"

    # Yahoo OAuth — needed by the YahooClient to refresh + call the Fantasy API.
    yahoo_client_id: str | None = None
    yahoo_client_secret: str | None = None
    # Base URL of the web app; the OAuth redirect_uri is required even on refresh.
    app_base_url: str = "https://fantasy.chriskim.cloud"

    # AES-256-GCM key (base64, 32 bytes) shared with web to decrypt stored tokens.
    token_enc_key: str | None = None


settings = Settings()
