"""
UDP broadcast discovery for Gree AC units on the local network.

Flow, confirmed against tomikaa87/gree-remote:
  1. Broadcast {"t":"scan"} — this one packet is PLAINTEXT, unencrypted —
     to <broadcast>:7000.
  2. Every Gree unit on the LAN replies with a "pack" envelope. We don't
     know the cipher yet, so we try ECB first, then re-check: if the
     envelope has a "tag" field it was actually GCM and we decrypt again
     with the GCM key. See protocol.detect_mode_from_envelope.
"""

import json
import socket
from dataclasses import dataclass, field

from . import protocol


@dataclass
class DiscoveredDevice:
    ip: str
    mac: str
    name: str
    firmware: str
    cipher_mode: str
    raw: dict = field(default_factory=dict)


def scan(broadcast_ip: str = "255.255.255.255", timeout: float = 3.0) -> list[DiscoveredDevice]:
    """Blocking discovery scan — safe to call from a sync context (the
    diagnose.py CLI calls this directly). The FastAPI route runs it in a
    threadpool since it's a sync def, so it won't block the event loop.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(timeout)
    sock.bind(("", 0))

    sock.sendto(json.dumps({"t": "scan"}).encode("utf-8"), (broadcast_ip, protocol.PORT))

    found: dict[str, DiscoveredDevice] = {}
    try:
        while True:
            data, addr = sock.recvfrom(4096)
            try:
                envelope = json.loads(data.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            if envelope.get("t") != "pack" or "pack" not in envelope:
                continue

            cipher_mode = protocol.detect_mode_from_envelope(envelope)
            key = (
                protocol.GENERIC_KEY_GCM
                if cipher_mode == protocol.CipherMode.GCM
                else protocol.GENERIC_KEY_ECB
            )

            try:
                pack = protocol.decrypt_pack(envelope, key, cipher_mode)
            except (ValueError, KeyError):
                # Wrong key / malformed padding / bad tag — skip, don't crash the scan.
                continue

            mac = pack.get("mac") or envelope.get("cid", addr[0])
            found[mac] = DiscoveredDevice(
                ip=addr[0],
                mac=mac,
                name=pack.get("name") or "<unnamed>",
                firmware=pack.get("ver", "unknown"),
                cipher_mode=cipher_mode,
                raw=pack,
            )
    except socket.timeout:
        pass
    finally:
        sock.close()

    return list(found.values())
