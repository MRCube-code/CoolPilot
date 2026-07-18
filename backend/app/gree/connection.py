"""
ManagedConnection wraps a raw GreeDevice (protocol.py/device.py — unchanged
since Phase 1) with the operational concerns Phase 2 asked for:
reconnection, retries, and diagnostics counters. GreeDevice itself stays a
dumb, single-purpose primitive on purpose — this is where "what happens
when the AC doesn't answer" lives, not down in the protocol layer.
"""

import logging
import time
from dataclasses import dataclass, field

from .device import BindError, GreeDevice

logger = logging.getLogger("coolpilot.gree.connection")

MAX_RETRIES = 3
BACKOFF_BASE_SECONDS = 1.0  # 1s, 2s, 4s


@dataclass
class ConnectionStats:
    bound_at: float | None = None
    last_success_at: float | None = None
    last_error: str | None = None
    last_error_at: float | None = None
    consecutive_failures: int = 0
    total_commands: int = 0
    total_status_reads: int = 0
    total_errors: int = 0
    total_rebinds: int = 0


class ManagedConnection:
    """One of these per bound device. Not thread-safe on its own — the
    caller (DeviceQueueWorker) is what guarantees only one operation runs
    against a given device at a time."""

    def __init__(self, device: GreeDevice):
        self.device = device
        self.stats = ConnectionStats()

    @property
    def mac(self) -> str:
        return self.device.mac

    def bind(self) -> str:
        key = self.device.bind()
        self.stats.bound_at = time.time()
        self.stats.consecutive_failures = 0
        logger.info("Bound to %s (%s)", self.device.mac, self.device.ip)
        return key

    def _with_retry(self, op_name: str, fn, *, count_as: str):
        last_exc: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                result = fn()
                self.stats.last_success_at = time.time()
                self.stats.consecutive_failures = 0
                setattr(self.stats, count_as, getattr(self.stats, count_as) + 1)
                return result
            except BindError as exc:
                last_exc = exc
                self.stats.consecutive_failures += 1
                self.stats.total_errors += 1
                self.stats.last_error = str(exc)
                self.stats.last_error_at = time.time()
                logger.warning(
                    "%s attempt %d/%d for %s failed: %s",
                    op_name, attempt, MAX_RETRIES, self.device.mac, exc,
                )
                if attempt < MAX_RETRIES:
                    # The device's per-session key can go stale (AC rebooted,
                    # WiFi module reset, etc). Re-bind before the next retry
                    # rather than hammering it with the same now-invalid key.
                    try:
                        self.bind()
                        self.stats.total_rebinds += 1
                    except BindError as rebind_exc:
                        logger.warning("Rebind for %s also failed: %s", self.device.mac, rebind_exc)
                    time.sleep(BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)))
        logger.error("%s for %s failed after %d attempts", op_name, self.device.mac, MAX_RETRIES)
        raise last_exc  # type: ignore[misc]

    def get_status(self, keys: list[str] | None = None) -> dict:
        return self._with_retry(
            "status read", lambda: self.device.get_status(keys), count_as="total_status_reads"
        )

    def set_properties(self, values: dict) -> dict:
        return self._with_retry(
            "command", lambda: self.device.set_properties(values), count_as="total_commands"
        )

    def diagnostics(self) -> dict:
        s = self.stats
        return {
            "mac": self.device.mac,
            "ip": self.device.ip,
            "cipher_mode": self.device.cipher_mode,
            "bound": self.device.device_key is not None,
            "bound_at": s.bound_at,
            "last_success_at": s.last_success_at,
            "last_error": s.last_error,
            "last_error_at": s.last_error_at,
            "consecutive_failures": s.consecutive_failures,
            "total_commands": s.total_commands,
            "total_status_reads": s.total_status_reads,
            "total_errors": s.total_errors,
            "total_rebinds": s.total_rebinds,
        }
