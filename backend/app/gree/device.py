"""
High-level per-device control: bind -> read status -> send commands.

This is the ONLY module the rest of the backend (API routes, automations,
energy logging) should ever import from. protocol.py and discovery.py are
plumbing underneath it. If the transport ever has to change — a third
cipher variant shows up, or a unit turns out to need a cloud relay instead
— this is the seam where that swap happens without touching anything above it.
"""

import json
import socket

from . import protocol
from .properties import STATUS_KEYS


class BindError(Exception):
    """Raised when the device rejects a bind request or doesn't respond."""


class GreeDevice:
    def __init__(self, ip: str, mac: str, cipher_mode: str, port: int = protocol.PORT):
        self.ip = ip
        self.mac = mac
        self.cipher_mode = cipher_mode
        self.port = port
        self.device_key: bytes | None = None

    def _send(self, pack_payload: dict, key: bytes, timeout: float = 3.0) -> dict:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        try:
            pack_fields = protocol.encrypt_pack(pack_payload, key, self.cipher_mode)
            envelope = protocol.build_envelope(pack_fields, cid="app", tcid=self.mac)
            sock.sendto(json.dumps(envelope).encode("utf-8"), (self.ip, self.port))
            data, _ = sock.recvfrom(4096)
            response_envelope = json.loads(data.decode("utf-8"))
            return protocol.decrypt_pack(response_envelope, key, self.cipher_mode)
        except socket.timeout as exc:
            raise BindError(f"No response from {self.ip}:{self.port} within {timeout}s") from exc
        finally:
            sock.close()

    def bind(self) -> str:
        """Exchange the generic key for this device's unique key. Must be
        called once (per process) before get_status()/set_properties().
        Per greeclimate's maintainer notes, binding is timing-sensitive —
        some units only answer a bind request immediately after a scan."""
        generic_key = (
            protocol.GENERIC_KEY_GCM
            if self.cipher_mode == protocol.CipherMode.GCM
            else protocol.GENERIC_KEY_ECB
        )
        response = self._send({"mac": self.mac, "t": "bind", "uid": 0}, generic_key)
        if response.get("t") != "bindok" or "key" not in response:
            raise BindError(f"Bind failed, device responded: {response}")
        self.device_key = response["key"].encode("utf-8")
        return response["key"]

    def get_status(self, keys: list[str] | None = None) -> dict:
        if not self.device_key:
            raise BindError("Call bind() before get_status()")
        keys = keys or STATUS_KEYS
        response = self._send({"cols": keys, "mac": self.mac, "t": "status"}, self.device_key)
        cols = response.get("cols", [])
        values = response.get("dat", [])
        return dict(zip(cols, values))

    def set_properties(self, values: dict) -> dict:
        """values example: {"Pow": 1, "SetTem": 24}. The device does not
        push changes proactively — call get_status() afterward if you need
        to confirm the new state."""
        if not self.device_key:
            raise BindError("Call bind() before set_properties()")
        opt = list(values.keys())
        p = list(values.values())
        response = self._send({"opt": opt, "p": p, "t": "cmd"}, self.device_key)
        # Some firmwares omit "val" and only return "p" — handle both (see docs/GREE_PROTOCOL.md).
        result_values = response.get("val", response.get("p", p))
        return dict(zip(response.get("opt", opt), result_values))

    # --- convenience wrappers, Celsius-first per docs/GREE_PROTOCOL.md §4 -----
    def power(self, on: bool) -> dict:
        return self.set_properties({"Pow": 1 if on else 0})

    def set_temperature_celsius(self, celsius: int) -> dict:
        return self.set_properties({"TemUn": 0, "SetTem": celsius})

    def turbo(self, on: bool) -> dict:
        return self.set_properties({"Tur": 1 if on else 0})

    def sleep_mode(self, on: bool) -> dict:
        return self.set_properties({"SwhSlp": 1 if on else 0})
