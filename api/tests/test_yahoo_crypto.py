"""AES-256-GCM token crypto, incl. a cross-language regression vector.

The vector was produced by the web service (web/lib/yahoo/crypto.ts) with the
test key below; if either side's wire format drifts, this fails.
"""

import base64

import pytest

from app.config import settings
from app.yahoo import crypto

# Throwaway test key (NOT a real TOKEN_ENC_KEY).
TEST_KEY = "l8kRkg2DZbzutnmHk9okfUL12VzBhXqBfJbBag9eFxs="
# Node (web) encrypt("interop-test-plaintext") with TEST_KEY:
NODE_VECTOR = "otNX284sl7aboz2H3vUuhFwvHiYnZAHOTtTl4Xjsh1oGdX7MP2de7LCLaiptsVgm0HU="
PLAINTEXT = "interop-test-plaintext"


@pytest.fixture(autouse=True)
def _key(monkeypatch):
    monkeypatch.setattr(settings, "token_enc_key", TEST_KEY)


def test_roundtrip():
    assert crypto.decrypt(crypto.encrypt("hello-token")) == "hello-token"


def test_decrypts_node_produced_vector():
    # Proves the api decrypts what the web service wrote (iv||ct||tag format).
    assert crypto.decrypt(NODE_VECTOR) == PLAINTEXT


def test_ciphertext_is_nondeterministic():
    # Random IV per call -> two encryptions of the same text differ.
    assert crypto.encrypt("x") != crypto.encrypt("x")


def test_rejects_bad_key_length(monkeypatch):
    monkeypatch.setattr(settings, "token_enc_key", base64.b64encode(b"short").decode())
    with pytest.raises(ValueError):
        crypto.encrypt("x")
