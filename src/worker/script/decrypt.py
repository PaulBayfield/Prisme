"""Decrypt the payload copied from the LCL Creds Grabber extension popup.

The extension (src/extension/src/popup.js) takes the captured login/account
data, JSON-encodes it, compresses it with LZString (compressToBase64), then
encrypts it with CryptoJS.AES.encrypt(compressed, passphrase). CryptoJS's
passphrase-based AES is OpenSSL-compatible: the base64 ciphertext is
"Salted__" + 8-byte salt + AES-256-CBC ciphertext, with the key/IV derived
from the passphrase and salt via OpenSSL's EVP_BytesToKey (MD5, 1 round).
This script reverses each of those steps.
"""

import argparse
import base64
import hashlib
import json

from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from lzstring import LZString


def evp_bytes_to_key(passphrase: bytes, salt: bytes, key_len: int, iv_len: int) -> tuple[bytes, bytes]:
    derived = b""
    block = b""
    while len(derived) < key_len + iv_len:
        block = hashlib.md5(block + passphrase + salt).digest()
        derived += block
    return derived[:key_len], derived[key_len:key_len + iv_len]


def decrypt_extension_payload(encrypted_b64: str, passphrase: str) -> dict:
    encrypted_b64 = encrypted_b64.strip()
    if len(encrypted_b64.rstrip("=")) % 4 == 1 or not encrypted_b64:
        raise ValueError(
            f"Payload looks truncated or pasted incorrectly (length={len(encrypted_b64)}); "
            "re-copy it from the extension popup and pass it in quotes as a single argument"
        )

    raw = base64.b64decode(encrypted_b64)
    if raw[:8] != b"Salted__":
        raise ValueError("Payload is not a CryptoJS OpenSSL-salted blob")

    salt, ciphertext = raw[8:16], raw[16:]
    key, iv = evp_bytes_to_key(passphrase.encode("utf-8"), salt, key_len=32, iv_len=16)

    try:
        plaintext = unpad(AES.new(key, AES.MODE_CBC, iv).decrypt(ciphertext), AES.block_size)
    except ValueError as exc:
        raise ValueError(
            "Decryption failed (bad padding). Likely causes: wrong passphrase, "
            "the extension's dist/ bundle is stale (rebuild with `npm run dev`/`npm run prod` "
            "and reload it in the browser), or the payload was truncated/altered when pasted."
        ) from exc
    compressed_b64 = plaintext.decode("utf-8")

    json_str = LZString().decompressFromBase64(compressed_b64)
    return json.loads(json_str)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("payload", help="Base64 CryptoJS payload copied from the extension popup")
    parser.add_argument("passphrase", help="Passphrase used to encrypt the payload")
    args = parser.parse_args()

    print(json.dumps(decrypt_extension_payload(args.payload, args.passphrase), indent=2))


if __name__ == "__main__":
    main()
