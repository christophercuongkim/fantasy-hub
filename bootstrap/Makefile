# Yahoo league importer — scrape + load.
#
# Scrape paths:
#   * make scrape-auto  — you're AT a display: one command. Launches a real
#     Chrome, you log in once, it attaches + scrapes. Real (non-automated)
#     browser, so JS lazy-loads correctly (weekly matchups etc.).
#   * make scrape       — simplest: the driver launches Chrome itself.
#   * make chrome + make scrape-attach — remoting in: start Chrome on the display
#     machine, then attach from wherever the scraper runs.
#
# `#` is escaped as `\#` below (Make treats a bare # as a comment).

SHELL := bash
SCRAPE_SHELL := nix develop '..\#scrape' -c
DEV_SHELL    := nix develop '..' -c
CHROMIUM     := nix shell nixpkgs\#chromium -c chromium
PY   := uv run python -m
PORT ?= 9222
PROFILE ?= $$HOME/.yahoo-scrape-profile
ARGS ?=

.PHONY: help scrape scrape-auto chrome scrape-attach dump dump-attach load

help:
	@echo "At a display (recommended):"
	@echo "  make scrape-auto            # launch real Chrome + log in once + scrape all"
	@echo "  make scrape-auto ARGS='--only 2025'"
	@echo ""
	@echo "Alternatives:"
	@echo "  make scrape                 # driver launches Chrome (automation-flagged)"
	@echo "  make chrome                 # (remote) open Chrome on :$(PORT) on the display box"
	@echo "  make scrape-attach          # (remote) attach to that Chrome and scrape"
	@echo ""
	@echo "Explore / load:"
	@echo "  make dump URL='https://...'         # save a page's html to data/_dumps/"
	@echo "  make dump-attach URL='https://...'  # same, via the attached Chrome"
	@echo "  make load [ARGS='--only 2025']      # load data/ into \$$DATABASE_URL"

# --- at a display: one command (real Chrome + login gate + attach scrape) ---
scrape-auto:
	$(CHROMIUM) --remote-debugging-port=$(PORT) --user-data-dir="$(PROFILE)" >/dev/null 2>&1 & \
	sleep 4; \
	$(SCRAPE_SHELL) $(PY) importer.scrape --attach 127.0.0.1:$(PORT) --login-gate $(ARGS)

# --- simplest: the webdriver launches Chrome ---
scrape:
	$(SCRAPE_SHELL) $(PY) importer.scrape $(ARGS)

# --- remoting in: start Chrome on the display box, then attach ---
chrome:
	$(CHROMIUM) --remote-debugging-port=$(PORT) --user-data-dir="$(PROFILE)"

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
