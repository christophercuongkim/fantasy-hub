# syntax=docker/dockerfile:1
# Build context is the REPO ROOT (matches docker-compose and Dokploy's default),
# so all COPY paths are prefixed with api/.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
# Install deps first (cached) from the lockfile, then copy source.
COPY api/pyproject.toml api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY api/app ./app
EXPOSE 4001
CMD ["uv", "run", "--no-dev", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4001"]
