# CoolPilot

Smart controller for a Gree WiFi Inverter AC (Cosmo series / GS-18XCOAV
family) — talks to the unit directly over the local network. No cloud
relay, no Home Assistant dependency, no official Gree app required after
initial WiFi setup.

## Status: Phase 2 — backend hardened, dashboard live

Before any UI, automations, or energy tracking, the one thing that had to be
settled against real evidence was: *can this AC be controlled locally, and
how, exactly?* Full research and sources: **`docs/GREE_PROTOCOL.md`** —
read that first.

Short version: yes. It speaks the same reverse-engineered EWPE Smart / GREE+
protocol most Gree-based ACs use — JSON over UDP, port 7000. What is **not**
yet confirmed is which of two encryption variants (ECB vs GCM) this specific
physical unit uses. That can't be looked up — it has to be asked of the real
device. That's what `scripts/diagnose.py` is for.

## Quick start

Backend first (this is what actually talks to the AC):
```bash
cd backend && pip install -r requirements.txt --break-system-packages
python3 scripts/diagnose.py   # confirm local control works against your real unit
uvicorn app.main:app --reload --port 8000
```

Then the frontend, in a second terminal — see `frontend/README.md` for
full setup, design notes, and an honest breakdown of what's real vs.
placeholder on each page:
```bash
cd frontend && cp .env.local.example .env.local && npm install && npm run dev
```

## Full Android app (everything running on the phone itself)

This is the "install it like a real app" path: the FastAPI backend runs
in Termux on your phone, the Capacitor-wrapped frontend is a normal
installed app icon, and they talk to each other over `127.0.0.1` —
nothing leaves the phone, no home server needed.

**1. Get a backend running in Termux, on the phone.**

Use Termux from F-Droid or the GitHub releases page, not the Play Store
version — the Play Store build has been unmaintained for years and is
missing packages you'll need.

```bash
pkg update && pkg install python git
git clone https://github.com/MRCube-code/CoolPilot
cd CoolPilot/backend
pip install -r requirements.txt   # if this errors about an "externally
                                   # managed environment", add
                                   # --break-system-packages and retry —
                                   # whether Termux's Python needs that
                                   # flag depends on the Termux version,
                                   # so try without it first
python3 scripts/diagnose.py       # confirm it can actually reach your AC
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Leave that running. Two things stop Android from killing it in the
background:
- `termux-wake-lock` (run it in the same or another Termux session) —
  keeps the CPU from sleeping while Termux is active.
- Android Settings → Apps → Termux → Battery → **Unrestricted**. Without
  this, Android's battery optimizer will eventually kill the process
  anyway regardless of the wake lock.

**2. Get the APK.**

This repo's `.github/workflows/android-build.yml` builds one for you —
no Android Studio, no SDK setup on your end:

1. On GitHub (works fine from the mobile site): **Actions** tab → *Build
   Android APK* → **Run workflow**.
2. Wait for it to finish (a few minutes), open the completed run, download
   the `coolpilot-debug-apk` artifact — it's a zip containing `app-debug.apk`.
3. On your phone: allow installs from your browser/file manager if
   prompted (Android will ask the first time you install an APK from
   outside the Play Store), then open the APK to install it.

**3. Open the app, go to Devices, Scan, Pair.** Same flow as the web
version — it's the same frontend, just running as an installed app that
happens to point at `127.0.0.1:8000` instead of a browser tab.

Full technical detail on what the Capacitor setup actually does (network
security config, the static-export build, why no native UDP bridge is
needed) is in `frontend/README.md`'s Android section.

## Try the API

```bash
uvicorn app.main:app --reload --port 8000
```

- `GET /api/devices/discover` — fresh broadcast scan (read-only, doesn't bind)
- `POST /api/devices/bind` — body: `{"mac", "ip", "cipher_mode", "name"}` (from a discover result)
- `GET /api/devices` — devices bound this session (from the registry, not a live scan)
- `DELETE /api/devices/{mac}` — forget a device
- `GET /api/devices/{mac}/status?fresh=false` — cached (poller) by default, `?fresh=true` forces a live read
- `POST /api/devices/{mac}/command` — body: `{"values": {"Pow": 1, "SetTem": 24}}`
- `GET /api/diagnostics` / `GET /api/devices/{mac}/diagnostics` — poller + per-device retry/error counters
- `GET /api/health`

CORS is open to `http://localhost:3000` and `https://localhost` (the
Capacitor Android app's origin) by default — set `COOLPILOT_ALLOWED_ORIGINS`
(comma-separated) if the frontend runs somewhere else.

## Project structure

```
coolpilot/
├── .github/workflows/
│   └── android-build.yml     # builds a debug APK in CI, no local Android SDK needed
├── docs/
│   └── GREE_PROTOCOL.md      # protocol research, incl. Phase 2 firmware verification
├── backend/
│   ├── requirements.txt
│   ├── data/                 # known_devices.json lives here (git-ignore this)
│   ├── logs/                 # rotating log file lives here (git-ignore this)
│   ├── app/
│   │   ├── main.py           # FastAPI app + CORS + lifespan startup/shutdown
│   │   ├── logging_config.py
│   │   └── gree/
│   │       ├── protocol.py    # AES ECB + GCM wire format — Phase 1, unchanged
│   │       ├── discovery.py   # UDP broadcast scan + cipher auto-detect — Phase 1, unchanged
│   │       ├── device.py      # bind / status / command primitive — Phase 1, unchanged
│   │       ├── properties.py  # opcode table with meanings — Phase 1, unchanged
│   │       ├── connection.py  # Phase 2: retry/backoff/rebind + diagnostics counters
│   │       ├── queue_worker.py# Phase 2: per-device asyncio command queue
│   │       ├── registry.py    # Phase 2: owns bound devices + known_devices.json persistence
│   │       └── poller.py      # Phase 2: background status polling loop
│   └── scripts/
│       └── diagnose.py       # run this against the real AC first
└── frontend/                 # Phase 2 — Next.js dashboard, see frontend/README.md for setup + design notes
    ├── capacitor.config.ts
    └── android-patches/      # network security config + patch script, applied post `cap add android`
```

## Why it's structured this way

`protocol.py` is the only file that knows AES exists. `device.py` is the
only file that imports `protocol.py`, and stays a dumb single-purpose
primitive on purpose. `connection.py` wraps it with retry/reconnect —
"what happens when the AC doesn't answer" lives there, not in the protocol
layer. `queue_worker.py` serializes traffic per device so a status poll and
a command from the UI can't race each other. `registry.py` is the only
thing `main.py` talks to. If the cipher story gets more complicated, or a
future firmware needs a third variant, that's still a one-file change in
`protocol.py` — nothing above it needs to know.

The orchestration logic (retry/backoff, the async queue, registry
persistence, the poller loop) was smoke-tested against a fake device before
shipping — real bug caught and fixed that way: a naming collision between
the `registry` module and its exported singleton. Full crypto round-trip
verification is still the Phase 1 test (pycryptodome isn't installed in the
sandbox this was built in, so that couldn't be re-run this pass — the logic
built on top of it was tested independently instead).

## Roadmap (sequenced on purpose — each phase starts once the last is proven)

1. **Communication layer** ✅ Phase 1 — confirm local control works against the real unit
2. **Backend hardening + Next.js dashboard** ✅ this delivery — reconnect/queue/diagnostics, live control UI
3. Automations engine — real backend persistence + a server-side scheduler (today: client-side only, time triggers only, browser tab must be open — see frontend/README.md)
4. Energy dashboard backed by real data — needs your actual electricity tariff + measured runtime; not estimated from guessed wattage
5. Weather integration, AI suggestions backed by real runtime history
6. Real accounts/auth — today's temperature-lock PIN is a client-side deterrent only, not real security (see frontend/README.md)
7. WebSocket push (poller already structured for this)
8. ✅ **Android app** — Capacitor wrapping the existing frontend, CI builds an installable debug APK, backend runs in Termux on the same phone. No native UDP bridge needed: the frontend already only speaks HTTP, the backend does the UDP work — see frontend/README.md's Android section. Not done yet within this: a *signed release* build for the Play Store (debug APK only), and the app can't be repointed at a different backend URL without a rebuild (static export bakes it in at build time).

## License

Not yet chosen — say the word and I'll add one.
