"""
Background status poller.

The AC has no push mechanism (docs/GREE_PROTOCOL.md section 5) — a change
made from the physical remote or the official app is invisible until
someone asks. This loop asks, on an interval, for every bound device, and
caches the result on that device's DeviceQueueWorker (`last_status` /
`last_status_at`) so GET /api/devices/{mac}/status can usually answer
instantly from cache instead of round-tripping to the AC on every request.
This is also the foundation the WebSocket push layer (Phase 2b) will sit on
top of — it doesn't exist yet, but this is where it would plug in: broadcast
whenever last_status changes instead of just caching it.
"""

import asyncio
import logging
import time

from .registry import DeviceRegistry

logger = logging.getLogger("coolpilot.gree.poller")

DEFAULT_POLL_INTERVAL_SECONDS = 10.0


class StatusPoller:
    def __init__(self, registry: DeviceRegistry, interval: float = DEFAULT_POLL_INTERVAL_SECONDS):
        self.registry = registry
        self.interval = interval
        self._task: asyncio.Task | None = None
        self.last_cycle_at: float | None = None
        self.cycle_count: int = 0

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())
            logger.info("Status poller started, interval=%ss", self.interval)

    def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()

    async def _run(self) -> None:
        while True:
            for mac in self.registry.all_macs():
                worker = self.registry.get_worker(mac)
                if not worker:
                    continue
                try:
                    await worker.get_status()
                except Exception as exc:  # noqa: BLE001 — one device's failure must not stop the loop
                    logger.warning("Poll failed for %s: %s", mac, exc)
            self.cycle_count += 1
            self.last_cycle_at = time.time()
            await asyncio.sleep(self.interval)
