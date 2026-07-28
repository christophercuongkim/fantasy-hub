"""Chrome driver + safe navigation for the scraper.

Manual-login by design (Yahoo 2FA + bot-detection): a visible Chrome you log
into once. --attach drives a Chrome you launched yourself with
--remote-debugging-port, which has no automation fingerprint (the reliable path
if Yahoo ever bot-blocks the driver-launched session).
"""

from __future__ import annotations

import shutil
import sys
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service


def build_driver(user_data_dir: Path, attach: str | None) -> webdriver.Chrome:
    chromedriver = shutil.which("chromedriver")
    if not chromedriver:
        sys.exit(
            "chromedriver not on PATH. Run inside:\n"
            "  nix shell nixpkgs#chromedriver nixpkgs#chromium -c <cmd>"
        )
    opts = Options()
    if attach:
        opts.add_experimental_option("debuggerAddress", attach)
        return webdriver.Chrome(service=Service(chromedriver), options=opts)

    chromium = shutil.which("chromium") or shutil.which("google-chrome-stable")
    if not chromium:
        sys.exit("chromium not on PATH (needed unless you use --attach).")
    opts.binary_location = chromium
    opts.add_argument(f"--user-data-dir={user_data_dir}")
    opts.add_argument("--window-size=1400,1000")
    # NixOS chromium has no configured setuid sandbox.
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    driver = webdriver.Chrome(service=Service(chromedriver), options=opts)
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"},
    )
    return driver


def manual_login_gate(driver: webdriver.Chrome) -> None:
    driver.get("https://login.yahoo.com")
    print(
        "\n>>> Log in to Yahoo in the browser (do the 2FA), then press ENTER...",
        flush=True,
    )
    input()


def goto(driver: webdriver.Chrome, url: str, settle: float = 1.5) -> None:
    """Navigate; fail loudly on Yahoo's bot-block page."""
    driver.get(url)
    time.sleep(settle)
    src = driver.page_source
    if "Will be right back" in src or "sad-panda" in src:
        raise RuntimeError(
            "Yahoo served its bot-block page. Launch Chrome yourself with "
            "--remote-debugging-port=9222, log in, and rerun with --attach 127.0.0.1:9222"
        )
