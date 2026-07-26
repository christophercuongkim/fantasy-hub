"""AES-256-GCM at rest, interoperable with the web service (web/lib/yahoo/crypto.ts).

Wire format: base64( iv[12] || ciphertext || tag[16] ). Node concatenates the
GCM tag after the ciphertext, which is exactly what AESGCM.decrypt expects as the
data argument, so blobs written by either service decrypt in the other.
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

IV_LEN = 12


def _key() -> bytes:
    if not settings.token_enc_key:
        raise RuntimeError("TOKEN_ENC_KEY is not set")
    key = base64.b64decode(settings.token_enc_key)
    if len(key) != 32:
        raise ValueError("TOKEN_ENC_KEY must be 32 bytes base64-encoded")
    return key


def encrypt(plaintext: str) -> str:
    iv = os.urandom(IV_LEN)
    ct = AESGCM(_key()).encrypt(iv, plaintext.encode(), None)
    return base64.b64encode(iv + ct).decode()


def decrypt(payload: str) -> str:
    raw = base64.b64decode(payload)
    iv, ct = raw[:IV_LEN], raw[IV_LEN:]
    return AESGCM(_key()).decrypt(iv, ct, None).decode()
