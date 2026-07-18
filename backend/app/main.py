"""
CoolPilot backend — Phase 2.

New since Phase 1: CORS (the Next.js frontend runs on a different origin
and would be silently blocked without this), the DeviceRegistry/queue/
poller stack in gree/, a diagnostics surface, and a device-manager style
bind/list/forget API. Automations persistence, energy accounting, weather,
and auth/PIN are still NOT here — see README.md roadmap. Building those
before this layer proved itself against a real device would just be more
code on an unverified foundation, same reasoning as Phase 1.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .gree import BindError, discovery, device_registry
from .gree.poller import StatusPoller
from .logging_config import setup_logging

setup_logging()
logger = logging.getLogger("coolpilot.main")

poller = StatusPoller(device_registry)


@asynccontextmanager
async def lifespan(app: FastAPI):
    device_registry.load()
    await device_registry.reconnect_known_devices()
    poller.start()
    logger.info("CoolPilot backend started")
    yield
    poller.stop()
    logger.info("CoolPilot backend shutting down")


app = FastAPI(title="CoolPilot API", version="0.2.0-phase2", lifespan=lifespan)

# The frontend runs on a different origin (localhost:3000 in dev) — without
# this, every browser fetch() call from it gets silently blocked by CORS
# and looks like a network error with no useful message. Configurable via
# env var for when this gets deployed somewhere that isn't localhost.
# https://localhost is not a typo or a duplicate of localhost:3000 — it's
# the origin Capacitor's Android WebView actually presents (confirmed
# Capacitor 8 default), needed once the app is running on-phone.
_allowed_origins = os.environ.get(
    "COOLPILOT_ALLOWED_ORIGINS",
    "http://localhost:3000,https://localhost",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- discovery -----------------------------------------------------------

@app.get("/api/devices/discover")
def discover_devices():
    """Broadcast-scan the LAN. This does NOT bind — it's read-only,
    safe to call as often as the UI wants (e.g. an "Add Device" flow)."""
    found = discovery.scan()
    return [
        {
            "mac": d.mac,
            "ip": d.ip,
            "name": d.name,
            "firmware": d.firmware,
            "cipher_mode": d.cipher_mode,
            "already_bound": device_registry.is_bound(d.mac),
        }
        for d in found
    ]


# --- device manager --------------------------------------------------------

class BindRequest(BaseModel):
    mac: str
    ip: str
    cipher_mode: str  # "ecb" or "gcm" — copy straight from a /api/devices/discover result
    name: str = ""


@app.post("/api/devices/bind")
async def bind_device(req: BindRequest):
    try:
        await device_registry.bind(ip=req.ip, mac=req.mac, cipher_mode=req.cipher_mode, name=req.name)
    except BindError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"status": "bound", "mac": req.mac}


@app.get("/api/devices")
def list_bound_devices():
    """Already-bound devices this session knows about — different from
    /api/devices/discover, which is a fresh broadcast scan."""
    return device_registry.list_bound()


@app.delete("/api/devices/{mac}")
def forget_device(mac: str):
    existed = device_registry.forget(mac)
    if not existed:
        raise HTTPException(status_code=404, detail="Unknown device")
    return {"status": "forgotten", "mac": mac}


# --- status / commands -----------------------------------------------------

def _get_worker_or_404(mac: str):
    worker = device_registry.get_worker(mac)
    if not worker:
        raise HTTPException(status_code=404, detail="Device not bound — POST /api/devices/bind first")
    return worker


@app.get("/api/devices/{mac}/status")
async def get_status(mac: str, fresh: bool = False):
    """By default returns the poller's cached value (near-instant, at
    most `poll interval` seconds stale). Pass ?fresh=true to force a live
    round-trip to the AC right now instead."""
    worker = _get_worker_or_404(mac)
    if not fresh and worker.last_status is not None:
        return {"cached": True, "polled_at": worker.last_status_at, "status": worker.last_status}
    try:
        status = await worker.get_status()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"cached": False, "polled_at": worker.last_status_at, "status": status}


class CommandRequest(BaseModel):
    values: dict


@app.post("/api/devices/{mac}/command")
async def send_command(mac: str, req: CommandRequest):
    worker = _get_worker_or_404(mac)
    try:
        return await worker.set_properties(req.values)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# --- diagnostics (Developer Tools page lives on this) -----------------------

@app.get("/api/diagnostics")
def system_diagnostics():
    return {
        "poller": {
            "interval_seconds": poller.interval,
            "cycle_count": poller.cycle_count,
            "last_cycle_at": poller.last_cycle_at,
        },
        "devices": [
            device_registry.get_connection(mac).diagnostics()
            for mac in device_registry.all_macs()
            if device_registry.get_connection(mac)
        ],
    }


@app.get("/api/devices/{mac}/diagnostics")
def device_diagnostics(mac: str):
    connection = device_registry.get_connection(mac)
    if not connection:
        raise HTTPException(status_code=404, detail="Device not bound")
    return connection.diagnostics()


@app.get("/api/health")
def health():
    return {"status": "ok"}
