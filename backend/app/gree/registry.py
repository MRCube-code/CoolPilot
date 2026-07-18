"""
DeviceRegistry — the single object the API layer (and later the
automations engine) talks to. Owns one ManagedConnection + one
DeviceQueueWorker per bound device, and persists just enough to disk
(mac/ip/cipher_mode/name) that a server restart doesn't force re-pairing
from scratch through the UI — it still re-binds on startup (session keys
aren't assumed to survive a restart), it just doesn't need a new discovery
scan to know where to look.

This is deliberately a JSON file, not a database. A real DB is Phase 2b
work (automations rules, energy history, user accounts all need one) — a
single dict of known devices doesn't.
"""

import json
import logging
import os
import time
from dataclasses import dataclass

from .connection import ManagedConnection
from .device import BindError, GreeDevice
from .queue_worker import DeviceQueueWorker

logger = logging.getLogger("coolpilot.gree.registry")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
KNOWN_DEVICES_FILE = os.path.join(DATA_DIR, "known_devices.json")


@dataclass
class KnownDevice:
    mac: str
    ip: str
    cipher_mode: str
    name: str = ""


class DeviceRegistry:
    def __init__(self):
        self._connections: dict[str, ManagedConnection] = {}
        self._workers: dict[str, DeviceQueueWorker] = {}
        self._known: dict[str, KnownDevice] = {}

    # --- persistence -----------------------------------------------------
    def load(self) -> None:
        if not os.path.exists(KNOWN_DEVICES_FILE):
            return
        try:
            with open(KNOWN_DEVICES_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
            self._known = {d["mac"]: KnownDevice(**d) for d in raw}
            logger.info("Loaded %d known device(s) from %s", len(self._known), KNOWN_DEVICES_FILE)
        except (json.JSONDecodeError, OSError, TypeError) as exc:
            logger.warning("Could not load %s: %s", KNOWN_DEVICES_FILE, exc)

    def _persist(self) -> None:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(KNOWN_DEVICES_FILE, "w", encoding="utf-8") as f:
            json.dump([vars(d) for d in self._known.values()], f, indent=2)

    async def reconnect_known_devices(self) -> None:
        """Called on startup. Best-effort — a device that's offline right
        now just stays unbound until the next discovery/bind or the poller
        retries it; it does not block startup."""
        for known in list(self._known.values()):
            try:
                await self.bind(known.ip, known.mac, known.cipher_mode, known.name, persist=False)
                logger.info("Reconnected to known device %s (%s)", known.name or known.mac, known.ip)
            except BindError as exc:
                logger.warning("Could not reconnect to %s at startup: %s", known.mac, exc)

    # --- lifecycle ---------------------------------------------------------
    async def bind(self, ip: str, mac: str, cipher_mode: str, name: str = "", persist: bool = True) -> None:
        device = GreeDevice(ip=ip, mac=mac, cipher_mode=cipher_mode)
        connection = ManagedConnection(device)
        connection.bind()  # raises BindError on failure — let the caller see it

        self._connections[mac] = connection
        worker = DeviceQueueWorker(connection)
        worker.start()
        self._workers[mac] = worker

        self._known[mac] = KnownDevice(mac=mac, ip=ip, cipher_mode=cipher_mode, name=name)
        if persist:
            self._persist()

    def forget(self, mac: str) -> bool:
        worker = self._workers.pop(mac, None)
        if worker:
            worker.stop()
        self._connections.pop(mac, None)
        existed = self._known.pop(mac, None) is not None
        if existed:
            self._persist()
        return existed

    # --- access --------------------------------------------------------
    def get_worker(self, mac: str) -> DeviceQueueWorker | None:
        return self._workers.get(mac)

    def get_connection(self, mac: str) -> ManagedConnection | None:
        return self._connections.get(mac)

    def is_bound(self, mac: str) -> bool:
        return mac in self._connections

    def list_bound(self) -> list[dict]:
        out = []
        for mac, connection in self._connections.items():
            known = self._known.get(mac)
            worker = self._workers.get(mac)
            out.append({
                "mac": mac,
                "ip": connection.device.ip,
                "name": known.name if known else "",
                "cipher_mode": connection.device.cipher_mode,
                "last_status": worker.last_status if worker else None,
                "last_status_at": worker.last_status_at if worker else None,
            })
        return out

    def all_macs(self) -> list[str]:
        return list(self._connections.keys())


# Module-level singleton — FastAPI's dependency system is overkill for a
# single-tenant backend like this one; every route just imports
# `device_registry`. Deliberately NOT named `registry` — that would shadow
# this very module (app.gree.registry) as soon as app/gree/__init__.py did
# `from .registry import registry`, since `import a.b as x` resolves via
# attribute lookup on `a.b`'s parent, not a direct sys.modules lookup, and
# a package-level rebind of the name `registry` would silently replace the
# module reference for anyone importing it that way. Caught this in
# testing — worth documenting so nobody reintroduces it.
device_registry = DeviceRegistry()
