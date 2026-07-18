"""
Per-device command queue.

The AC's WiFi module is a single little embedded chip — it does not expect
(and may misbehave on) two UDP requests in flight at once. If a status poll
and a "turn turbo on" HTTP request land at the same moment, they need to be
serialized, not fired concurrently. That's what this is for: one asyncio
queue and one worker task per device, everything else (HTTP handlers, the
background poller) just enqueues a job and awaits its result.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Literal

from .connection import ManagedConnection

logger = logging.getLogger("coolpilot.gree.queue")


@dataclass
class _Job:
    kind: Literal["status", "command"]
    payload: dict | None
    future: asyncio.Future = field(repr=False)
    enqueued_at: float = field(default_factory=time.time)


class DeviceQueueWorker:
    def __init__(self, connection: ManagedConnection):
        self.connection = connection
        self._queue: asyncio.Queue[_Job] = asyncio.Queue()
        self._task: asyncio.Task | None = None
        self.last_status: dict | None = None
        self.last_status_at: float | None = None

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()

    async def _run(self) -> None:
        logger.info("Queue worker started for %s", self.connection.mac)
        while True:
            job = await self._queue.get()
            try:
                if job.kind == "status":
                    result = await asyncio.to_thread(
                        self.connection.get_status, job.payload.get("keys") if job.payload else None
                    )
                    self.last_status = result
                    self.last_status_at = time.time()
                else:
                    result = await asyncio.to_thread(
                        self.connection.set_properties, job.payload or {}
                    )
                if not job.future.done():
                    job.future.set_result(result)
            except Exception as exc:  # noqa: BLE001 — surface every failure to the caller
                if not job.future.done():
                    job.future.set_exception(exc)
            finally:
                self._queue.task_done()

    async def get_status(self, keys: list[str] | None = None, timeout: float = 10.0) -> dict:
        return await self._submit("status", {"keys": keys}, timeout)

    async def set_properties(self, values: dict, timeout: float = 10.0) -> dict:
        return await self._submit("command", values, timeout)

    async def _submit(self, kind: Literal["status", "command"], payload: dict, timeout: float) -> Any:
        self.start()  # lazily (re)start if the worker task ever died
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        await self._queue.put(_Job(kind=kind, payload=payload, future=future))
        return await asyncio.wait_for(future, timeout=timeout)
