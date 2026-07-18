"""
gree — local UDP control for Gree WiFi inverter ACs (EWPE Smart / GREE+
compatible). See docs/GREE_PROTOCOL.md at the project root for the full
research writeup and sources behind everything in this package.

Layering, low-level to high-level:
  protocol.py   -- AES ECB/GCM wire format (Phase 1, unchanged)
  discovery.py  -- UDP broadcast scan (Phase 1, unchanged)
  device.py     -- GreeDevice: bind/status/command primitive (Phase 1, unchanged)
  connection.py -- ManagedConnection: retry/reconnect/diagnostics around a GreeDevice (Phase 2)
  queue_worker.py -- DeviceQueueWorker: serializes traffic to one device (Phase 2)
  registry.py   -- DeviceRegistry: owns all of the above + disk persistence (Phase 2)
  poller.py     -- StatusPoller: background loop, since the AC never pushes (Phase 2)

main.py should only ever import `registry` from this package. Nothing
above device.py should ever need to import protocol.py directly.
"""

from .device import BindError, GreeDevice
from . import discovery
from .registry import DeviceRegistry, device_registry
from .poller import StatusPoller

__all__ = ["GreeDevice", "BindError", "discovery", "DeviceRegistry", "device_registry", "StatusPoller"]
