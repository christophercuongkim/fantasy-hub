# fantasy-hub dev entrypoints. Run inside the nix dev shell (`nix develop`) so
# node/pnpm/python/uv are on PATH. Production builds go through Docker +
# Dokploy (see .github/workflows/deploy.yml) — this Makefile is local-only.

# Where the api reads/writes Parquet. Prod uses /data (Dokploy volume); locally
# we default to a user-writable dir the api will create on startup. Override to
# point at a real dataset: `make dev-api PARQUET_ROOT=/path/to/data`.
PARQUET_ROOT ?= $(CURDIR)/.data/dev

.PHONY: dev dev-web dev-api

# Run web (:4000) and api (:4001) together with live reload. Ctrl-C stops both:
# `trap 'kill 0'` tears down the whole process group, and `wait` blocks until
# both children exit so the trap actually fires.
dev:
	@echo "web → http://localhost:4000   api → http://localhost:4001   (Ctrl-C stops both)"
	@echo "web auth needs web/.env.local (AUTH_SECRET, AUTH_GOOGLE_ID/SECRET, ADMIN_EMAILS, DATABASE_URL)"
	@trap 'kill 0' EXIT INT TERM; \
		$(MAKE) --no-print-directory dev-api & \
		$(MAKE) --no-print-directory dev-web & \
		wait

dev-web:
	pnpm --dir web dev

dev-api:
	mkdir -p $(PARQUET_ROOT)
	cd api && PARQUET_ROOT=$(PARQUET_ROOT) uv run uvicorn app.main:app --reload --port 4001
