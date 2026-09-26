"""PBKDF2 hash checks for the shared secrets kept in config (never plaintext)."""

import hashlib
import hmac


def verify_pbkdf2(secret: str, encoded: str) -> bool:
    """Check `secret` against 'pbkdf2_sha256$iterations$salt_hex$hash_hex'."""
    try:
        algo, iterations, salt_hex, hash_hex = encoded.split("$")
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", secret.encode(), bytes.fromhex(salt_hex), int(iterations)).hex()
    return hmac.compare_digest(candidate, hash_hex)
