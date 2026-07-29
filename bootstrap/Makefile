# Yahoo league importer — scrape + load.
#
# Two scrape paths:
#   * WITH a display (your PC): `make scrape` — the driver launches Chrome.
#   * REMOTING into that PC: run `make chrome` on the PC (real on-screen Chrome,
#     log in), then `make scrape-attach` — the scraper drives that real browser.
#     Attach is also the fix when a page's JS lazy-loads content that a
#     headless/no-viewport browser won't render (e.g. weekly matchups).
#
# The browser lives in the flake's `.#scrape` dev shell (chromedriver+chromium).
# Loading needs no browser, just the default shell (psycopg lib paths).

SHELL := bash
SCRAPE_SHELL := nix develop '..#scrape' -c
DEV_SHELL    := nix develop '..' -c
PY   := uv run python -m
PORT ?= 9222
ARGS ?=

.PHONY: help scrape chrome scrape-attach dump dump-attach load

help:
	@echo "Scrape (PC with a display):"
	@echo "  make scrape                 # launches Chrome, manual login, scrapes all seasons"
	@echo "  make scrape ARGS='--only 2025'"
	@echo ""
	@echo "Scrape (remoted into the display PC):"
	@echo "  make chrome                 # on the PC: opens Chrome on :$(PORT), log in, leave open"
	@echo "  make scrape-attach          # attaches to that Chrome and scrapes"
	@echo ""
	@echo "Explore / load:"
	@echo "  make dump URL='https://...'         # save a page's html to data/_dumps/"
	@echo "  make dump-attach URL='https://...'  # same, via the attached Chrome"
	@echo "  make load                           # load data/ into \$$DATABASE_URL (idempotent)"
	@echo "  make load ARGS='--only 2025'"

# --- scrape: PC with a display (driver launches Chrome) ---
scrape:
	$(SCRAPE_SHELL) $(PY) importer.scrape $(ARGS)

# --- scrape: attach to a Chrome you launched on the display machine ---
chrome:
	nix shell nixpkgs#chromium -c \
	  chromium --remote-debugging-port=$(PORT) --user-data-dir=$$HOME/.yahoo-scrape-profile

scrape-attach:
	$(SCRAPE_SHELL) $(PY) importer.scrape --attach 127.0.0.1:$(PORT) $(ARGS)

# --- one-off page dump for exploration (--settle waits for JS) ---
dump:
	$(SCRAPE_SHELL) $(PY) importer.scrape --settle 8 --dump-url "$(URL)" $(ARGS)

dump-attach:
	$(SCRAPE_SHELL) $(PY) importer.scrape --attach 127.0.0.1:$(PORT) --settle 8 --dump-url "$(URL)"

# --- load scraped data into Postgres (DATABASE_URL from env) ---
load:
	$(DEV_SHELL) $(PY) loader.load $(ARGS)
