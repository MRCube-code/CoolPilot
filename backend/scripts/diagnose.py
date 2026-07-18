#!/usr/bin/env python3
"""
Run this FIRST, against the real AC, before trusting anything else in this
repo. It depends only on the gree/ package (no FastAPI needed) and prints
exactly what the device sends back — including which cipher mode it
auto-detected. That's the one fact nothing in docs/GREE_PROTOCOL.md could
confirm from documentation alone.

Usage:
    cd backend
    python3 scripts/diagnose.py

Run it from a machine (or Termux) on the SAME WiFi network as the AC. The
AC must already be bound to that WiFi via the GREE+ or EWPE Smart app —
this script takes over after that, it doesn't do initial provisioning.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.gree import discovery  # noqa: E402
from app.gree.device import GreeDevice  # noqa: E402


def main() -> None:
    print("Scanning for Gree devices on the LAN (UDP broadcast, port 7000)...")
    found = discovery.scan()

    if not found:
        print("No devices responded. Checklist:")
        print("  - Is this machine on the SAME WiFi network as the AC?")
        print("  - Some routers block UDP broadcast on guest networks / client isolation.")
        print("  - Has the AC ever been set up with the GREE+ or EWPE Smart app?")
        print("    It must be bound to your WiFi first.")
        return

    for d in found:
        print()
        print(f"Found: {d.name!r} at {d.ip}  mac={d.mac}")
        print(f"  firmware (ver) : {d.firmware}")
        print(f"  cipher detected: {d.cipher_mode}   <-- this is the fact we needed")
        print(f"  raw scan pack  : {d.raw}")

        device = GreeDevice(ip=d.ip, mac=d.mac, cipher_mode=d.cipher_mode)
        try:
            key = device.bind()
            print(f"  bind OK, device key: {key}")
        except Exception as exc:  # noqa: BLE001 — diagnostic script, want to see everything
            print(f"  bind FAILED: {exc}")
            continue

        try:
            status = device.get_status()
            print(f"  status: {status}")
        except Exception as exc:  # noqa: BLE001
            print(f"  status read FAILED: {exc}")

    print()
    print("Paste this whole output back before we build anything further —")
    print("it's the real evidence the rest of the app gets built on.")


if __name__ == "__main__":
    main()
