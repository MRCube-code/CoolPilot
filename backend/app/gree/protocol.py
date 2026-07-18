"""
Gree AC low-level wire protocol (EWPE Smart / GREE+ compatible).

Every constant in this file is taken from real, cited sources — see
docs/GREE_PROTOCOL.md at the project root. Nothing here is guessed.

Two AES variants exist in the wild:
  - ECB : older WiFi modules. AES-128-ECB + PKCS7 padding, one generic key.
  - GCM : newer WiFi modules (roughly firmware v1.21+, ~2022 onward).
          AES-128-GCM, a DIFFERENT generic key, a fixed nonce + AAD, and an
          auth tag that rides alongside "pack" as a sibling "tag" field.

Which one a given physical unit uses is NOT guessable from the model number.
It's detected empirically: a GCM unit's response envelope always contains a
"tag" field; an ECB unit's response never does. See discovery.py.
"""

import base64
import json

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

PORT = 7000

# Generic keys — used ONLY for the scan + bind handshake, before we have
# this specific device's unique key. Source: tomikaa87/gree-remote
# PythonCLI/gree.py, corroborated independently for the ECB key by
# SilentLeader/greeaclocalserver.
GENERIC_KEY_ECB = b"a3K8Bx%2r8Y7#xDh"
GENERIC_KEY_GCM = b"{yxAHAY_Lm6pbC/<"

# GCM uses a fixed nonce and fixed additional authenticated data — this is
# unusual for GCM (normally the nonce must never repeat) but it's what the
# device firmware actually does, confirmed from the same source above.
GCM_NONCE = bytes([0x54, 0x40, 0x78, 0x44, 0x49, 0x67, 0x5A, 0x51, 0x6C, 0x5E, 0x63, 0x13])
GCM_AAD = b"qualcomm-test"


class CipherMode:
    ECB = "ecb"
    GCM = "gcm"


def encrypt_pack(payload: dict, key: bytes, mode: str) -> dict:
    """Encrypt a plaintext pack dict into the field(s) that go into the
    outer envelope: just 'pack' for ECB, 'pack' + 'tag' for GCM."""
    plaintext = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    if mode == CipherMode.ECB:
        cipher = AES.new(key, AES.MODE_ECB)
        ciphertext = cipher.encrypt(pad(plaintext, AES.block_size))
        return {"pack": base64.b64encode(ciphertext).decode("utf-8")}

    if mode == CipherMode.GCM:
        cipher = AES.new(key, AES.MODE_GCM, nonce=GCM_NONCE)
        cipher.update(GCM_AAD)
        ciphertext, tag = cipher.encrypt_and_digest(plaintext)
        return {
            "pack": base64.b64encode(ciphertext).decode("utf-8"),
            "tag": base64.b64encode(tag).decode("utf-8"),
        }

    raise ValueError(f"Unknown cipher mode: {mode!r}")


def decrypt_pack(envelope: dict, key: bytes, mode: str) -> dict:
    """Decrypt the 'pack' (+ 'tag' for GCM) fields of a received envelope
    and return the embedded JSON object."""
    ciphertext = base64.b64decode(envelope["pack"])

    if mode == CipherMode.ECB:
        cipher = AES.new(key, AES.MODE_ECB)
        plaintext = unpad(cipher.decrypt(ciphertext), AES.block_size)
        return json.loads(plaintext.decode("utf-8"))

    if mode == CipherMode.GCM:
        tag = base64.b64decode(envelope["tag"])
        cipher = AES.new(key, AES.MODE_GCM, nonce=GCM_NONCE)
        cipher.update(GCM_AAD)
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)
        return json.loads(plaintext.decode("utf-8"))

    raise ValueError(f"Unknown cipher mode: {mode!r}")


def detect_mode_from_envelope(envelope: dict) -> str:
    """The community-standard heuristic (used by tomikaa87/gree-remote and
    current 2026 Home Assistant custom integrations): a GCM device's
    response envelope carries a 'tag' field, an ECB device's never does.
    There is no firmware-version field you can trust instead — this is it."""
    return CipherMode.GCM if "tag" in envelope else CipherMode.ECB


def build_envelope(pack_fields: dict, cid: str, tcid: str, i: int = 0, uid: int = 0) -> dict:
    """Assemble the plaintext outer envelope around already-encrypted pack fields."""
    envelope = {"cid": cid, "i": i, "t": "pack", "tcid": tcid, "uid": uid}
    envelope.update(pack_fields)
    return envelope
