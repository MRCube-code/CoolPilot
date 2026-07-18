# Gree WiFi AC — Communication Protocol Research

**Target unit:** Gree GS-18XCOAV/1 (WiFi Inverter, 1.5 ton / 18,000 BTU)
**Researched:** July 2026
**Verdict: local LAN control is available and is the right default. No cloud
dependency is required for day-to-day operation.**

---

## 1. Model identification — what's confirmed vs. inferred

"GS-18XCOAV/1" does not appear as an exact listed SKU in Gree's current retail
catalog. The closest matches found are **GS-18XCOA1V** and **GS-18XCOA3V**,
both part of Gree's **Cosmo series** (1.5 ton / 18,000 BTU, R32 refrigerant,
built-in WiFi + Bluetooth), sold predominantly in the Bangladesh market —
consistent with the Bangla-language requirement in the project brief. This is
almost certainly the same unit or an immediate sibling variant.

This match is **inferred, not confirmed** — but it doesn't actually matter much
for the architecture decision below, because:

- Gree standardizes the same WiFi/Bluetooth control module (and the same
  pairing apps) across most of its inverter split lineup — Cosmo, Pular,
  Shimo, Airy, and others all pair via the same two apps, per Gree's own
  Cosmo series service manual.
- The wire protocol lives in that shared WiFi module's firmware, not in the
  compressor/model-specific electronics.

So: high confidence on the protocol *family*. One specific detail — which of
two encryption variants this exact unit uses — genuinely can't be determined
from documentation and has to be tested against the real device. That's what
`scripts/diagnose.py` is for (see backend/).

## 2. Which app, which control path

Gree's official Cosmo series service manual lists **two interchangeable
apps** for this control module: **GREE+** and **EWPE Smart** ("optional" —
either one binds the same device). Critically, the manual states plainly that
installing EWPE Smart lets you "achieve long-distance control **and** LAN
control" of the appliance — i.e. Gree's own documentation confirms local
network control is a first-class supported mode, not just a side effect of
reverse engineering.

Source: Gree COSMO Series Service Manual (ManualsLib), section 6.6/6.7.

## 3. The underlying wire protocol

Both apps talk to the AC using the same reverse-engineered protocol, most
thoroughly documented by the open-source **tomikaa87/gree-remote** project
(built from Wireshark captures of the official Android app) and implemented
independently by several maintained libraries (`cmroche/greeclimate` — which
Home Assistant's built-in "Gree Climate" integration is built on —
`stas-demydiuk/ewpe-smart-mqtt`, and others). Home Assistant's own docs
confirm the integration's IoT class as **Local Polling**, and it's been in
core since HA 0.117 — this is a mature, production-grade approach, not a
fragile hack.

**Transport:** UDP, port **7000**, both unicast and broadcast. JSON payloads.

### Message envelope

Every message on the wire is a JSON object. The outer envelope is plaintext;
only the `pack` field (and, for GCM devices, a sibling `tag` field) is
encrypted:

```json
{
  "t": "pack",
  "i": 0,
  "uid": 0,
  "cid": "app",
  "tcid": "<device MAC>",
  "pack": "<base64, encrypted>",
  "tag": "<base64, GCM only>"
}
```

### Two encryption variants exist in the field

| | **ECB** (older / most common) | **GCM** (newer, WiFi module ≳ v1.21, roughly 2022+) |
|---|---|---|
| Cipher | AES-128-ECB, PKCS7 padding | AES-128-GCM |
| Generic key (scan/bind only) | `a3K8Bx%2r8Y7#xDh` | `{yxAHAY_Lm6pbC/<` |
| Nonce | n/a | fixed: `54 40 78 44 49 67 5a 51 6c 5e 63 13` |
| AAD | n/a | `qualcomm-test` |
| How to tell them apart | — | Response envelope contains a `tag` field. ECB responses never do. |

Both the generic ECB key and the GCM constants above are taken directly from
tomikaa87/gree-remote's Python CLI source and independently corroborated by a
second, unrelated implementation (SilentLeader/greeaclocalserver) for the ECB
key. The "detect by presence of `tag` field" heuristic is what the actively
maintained Home Assistant custom integrations use in production today (e.g.
a March 2026 community integration explicitly advertises "auto-detects
ECB / GCM encryption").

After binding, **every device gets its own unique key** (returned by the bind
response) used for all further status/command traffic — the generic key is
only ever used for the scan and bind handshake.

### Handshake flow

1. **Scan** — broadcast `{"t":"scan"}` (plaintext, unencrypted) to the LAN.
   Every Gree unit replies with a `pack` envelope encrypted under whichever
   generic key matches its cipher variant. Decrypting it (try ECB, check for
   a `tag` field, fall back to GCM) yields:
   ```json
   {"t":"dev","cid":"<mac>","mac":"<mac>","name":"<friendly name>","ver":"<firmware>", ...}
   ```
2. **Bind** — send `{"mac":"<mac>","t":"bind","uid":0}` encrypted under the
   generic key, addressed `tcid` to that device's MAC. Response decrypts to:
   ```json
   {"t":"bindok","mac":"<mac>","key":"<this device's unique key>","r":200}
   ```
3. **Status** — send `{"cols":[...],"mac":"<mac>","t":"status"}` encrypted
   under the device key. Response: `{"t":"dat","cols":[...],"dat":[...]}` —
   `cols` and `dat` are parallel arrays. The device does **not** push updates
   when changed via the physical remote or the app — polling is required.
4. **Command** — send `{"opt":[...],"p":[...],"t":"cmd"}` encrypted under the
   device key. Response: `{"t":"res","opt":[...],"p":[...],"val":[...]}`.
   Some firmwares omit `val` and only return `p` — handle both.

## 4. Property codes (the `opt`/`cols` keys)

Confirmed against tomikaa87/gree-remote's documented set, cross-checked
against the property list used by a currently-maintained Home Assistant
custom component (which has picked up a few newer keys since the original
2018 writeup):

| Key | Meaning | Values |
|---|---|---|
| `Pow` | Power | 0 off, 1 on |
| `Mod` | Mode | 0 auto, 1 cool, 2 dry, 3 fan, 4 heat |
| `SetTem` | Target temperature | integer, unit depends on `TemUn` |
| `TemUn` | Temperature unit | 0 Celsius, 1 Fahrenheit |
| `TemRec` | Fahrenheit half-degree disambiguator | see note below |
| `WdSpd` | Fan speed | 0 auto, 1 low, 2 med-low*, 3 med, 4 med-high*, 5 high (*3-speed units skip these) |
| `Air` | Fresh air valve | 0/1 (not all units have the hardware) |
| `Blo` | X-Fan / blow-dry after shutoff | 0/1, cool & dry mode only |
| `Health` | Cold-plasma / anion generator | 0/1 (needs the hardware) |
| `SwhSlp` | Sleep mode | 0/1 |
| `Lig` | Display light | 0/1 |
| `SwingLfRig` | Horizontal swing | 0 default, 1 full, 2–6 fixed positions (limited unit support) |
| `SwUpDn` | Vertical swing | 0 default, 1 full swing, 2–6 fixed, 7–11 swing sub-ranges |
| `Quiet` | Quiet mode | 0/1, not in dry/fan mode |
| `Tur` | Turbo | 0/1, cool & dry mode only, fan speed locked while active |
| `StHt` | 8°C frost-protection heating | 0/1 |
| `SvSt` | Power saving | 0/1 |
| `TemSen` | Internal temp sensor reading | raw value **minus 40** = actual °C |
| `SlpMod`, `AntiDirectBlow`, `LigSen` | Newer-firmware extras | seen in the field; not guaranteed present |

**Fahrenheit note:** setting `TemUn=1` alone is not sufficient on all
firmwares — some still store `SetTem` in Celsius and use the `TemRec` bit to
disambiguate which of two Fahrenheit values a given Celsius step maps to.
Conversion: `SetTem = round((f - 32) * 5/9)`, `TemRec = 1 if that rounds up else 0`.
**Recommendation: build and test entirely in Celsius first** — the AC is sold
in a Celsius market, this sidesteps the ambiguity entirely, and Fahrenheit
support can be added later once Celsius is proven against the real unit.

Not every key exists on every unit. Unsupported writes are silently ignored;
unsupported reads simply don't come back in `dat`. Treat this table as "worth
asking for," not a guarantee.

## 5. Operational caveats worth designing around

- **The unit phones home.** The WiFi module periodically sends heartbeat
  traffic to Gree's cloud (community reports point to a fixed IP on TCP port
  5000). This is how the app's remote-control-from-anywhere works. You can
  block it at the firewall for privacy, but on some firmwares this has been
  reported to make the unit stop responding to **local** requests too — so
  this should be a user-toggleable setting, default **off** (leave cloud
  traffic alone), not a hardcoded block.
- **Post-2022 WiFi modules are reportedly flakier** — intermittent dropped
  packets / disconnects are a recurring complaint in the Home Assistant
  community for newer units. Build reconnect/retry logic into the polling
  loop from day one rather than bolting it on after it breaks in the field.
- **Initial WiFi provisioning is out of scope for this app.** Every
  implementation surveyed (including HA's official integration) requires the
  AC to already be bound to your WiFi via GREE+ or EWPE Smart first. CoolPilot
  takes over *after* that's done — it doesn't replace initial setup.
- **No push notifications from the device.** State changes made via the
  physical remote or the official app are invisible until you poll. Plan the
  WebSocket layer as "poll on an interval, push what changed to clients" —
  not as a true event stream from the AC itself.

## 6. Architecture decision

**Talk to the AC directly over local UDP from the FastAPI backend.** No MQTT
broker, no cloud relay, no dependency on an existing Home Assistant instance
— those are all extra moving parts solving a problem this app doesn't have,
since the phone running CoolPilot and the backend it talks to are expected to
be on the same LAN as the AC.

The one seam that has to stay swappable, per the original brief: the cipher
variant (ECB vs GCM) is genuinely unknown until tested, and some future
firmware could theoretically use something else again. That's why the crypto
lives entirely behind `protocol.py`'s `encrypt_pack` / `decrypt_pack`
functions and nothing above `device.py` ever touches AES directly — swapping
in a third variant later is a one-file change.

## Sources

- Gree COSMO Series Service Manual — ManualsLib
- [tomikaa87/gree-remote](https://github.com/tomikaa87/gree-remote) — protocol reverse engineering, ECB + GCM constants
- [cmroche/greeclimate](https://github.com/cmroche/greeclimate) — GCM rollout PR #92, HA's underlying library
- [stas-demydiuk/ewpe-smart-mqtt](https://github.com/stas-demydiuk/ewpe-smart-mqtt)
- [SilentLeader/greeaclocalserver](https://github.com/SilentLeader/greeaclocalserver) — independent ECB key corroboration
- [RobHofmann/HomeAssistant-GreeClimateComponent](https://github.com/RobHofmann/HomeAssistant-GreeClimateComponent)
- [Home Assistant — Gree Climate integration docs](https://www.home-assistant.io/integrations/gree/)
- Home Assistant Community: "Gree Versati 3 integration" (March 2026) — confirms ECB/GCM auto-detect is current 2026 practice

## 7. Verification against the real, paired unit (added Phase 2)

Real device info collected from the Gree+ app, not guessed:

```
Model:            GS-18XCOAV/1
Firmware Version: V1.45
Model ID:         10001
Model Version:    V20.6
MAC:              580d0d54b6ea
```

Answering the ten questions asked, in order, with confidence level made explicit for each:

**1–2. Which protocol, and does V1.45 still use it?** Yes — nothing in this
firmware line has moved off the UDP/7000 JSON+AES protocol described in
section 3. The GREE+ app itself is what's driving it; the community
reverse-engineering (tomikaa87/gree-remote, section 3's sources) captured
real GREE+ traffic and it's still this protocol as of the most recent public
issue activity I could find (2025). Confidence: high.

**3. Is authentication needed after discovery?** Yes — the bind handshake
(section 3, step 2) *is* the authentication step. Discovery alone gets you a
device's presence and its encrypted `dev` announcement; you cannot read
status or send commands until you complete `bind` and receive that device's
unique key. `device.py`'s `bind()` already implements this.

**4. ECB, GCM, or something else — for *this* unit specifically?**
Here's the honest answer: **the app-displayed "Firmware Version: V1.45" and
"Model Version: V20.6" cannot be reliably mapped to the WiFi module's own
internal version string** (the one the UDP scan's `ver` field reports,
which looks like `"1.21"` or `"3.77"` in every real capture I found — a
different, chip-level number, not the same string shown in the app's About
screen). I'm not going to pretend those two numbering schemes are the same
thing just because it would be convenient.

What I *can* say with real evidence behind it: a GitHub issue against
tomikaa87/gree-remote contains an actual captured packet from the GREE+ app
talking to a unit on WiFi module firmware 1.21 — and that captured envelope
has a `tag` field, confirming GCM. The same issue reports firmware 1.16
working fine on the old ECB-only key. Combined with the separately-confirmed
"`ecb` below ~v1.21, `gcm` at/above it" threshold from section 3, and given
this unit's firmware line is well past that (whatever exact internal
version it turns out to be), **GCM is the reasonable default hypothesis for
this unit** — but it's a hypothesis, not a verified fact, which is exactly
why nothing in the codebase hardcodes it. `discovery.py`'s
`detect_mode_from_envelope()` doesn't care about any of this reasoning —
it just checks for the `tag` field on the real response and knows for
certain. Confidence in the hypothesis: medium. Confidence in the code
handling either answer correctly: high, because it doesn't depend on the
hypothesis.

**5. How does GREE+ actually talk to it?** Same handshake as section 3:
broadcast scan → decrypt with whichever generic key matches → bind for a
per-device key → poll status / push commands with that key. This isn't
inference — issue #63 above is a Wireshark-style capture of the real app
doing exactly this.

**6. Is local-only control possible, no Gree cloud?** Yes, for the
command-and-control path. The one thing genuinely tied to the cloud is
initial WiFi provisioning (pairing a brand-new unit to your WiFi network) —
your unit's already past that step. Ongoing "phone home" heartbeat traffic
(section 5) is separate and optional to block.

**7. Which ports?** UDP 7000 for control (confirmed, multiple independent
sources, unchanged from section 3). TCP 5000 to a Gree cloud IP for the
optional heartbeat (also section 5) — not used for local control.

**8. Pushed or polled?** Polled. No source anywhere — official docs,
reverse-engineering projects, or HA's own integration notes — describes the
device proactively pushing state changes. HA's own integration is
classified "Local Polling," not "Local Push," which is the clearest
confirmation available.

**9. Automatic discovery?** The broadcast scan in section 3 / `discovery.py`
*is* the automatic discovery mechanism — no MAC or IP needs to be known in
advance, the device announces itself in response to the broadcast.

**10. Do existing Python libraries already support this firmware?**
`greeclimate` (Home Assistant's underlying library) added GCM support
specifically because units in this firmware range started failing under
ECB-only — so yes, if this unit does turn out to need GCM, that's exactly
the scenario the wider community already hit and already has working code
for. Nothing here is a novel, unsupported case.

## What's still unverified (needs your real device)

1. ECB or GCM — run `scripts/diagnose.py` and read the `cipher detected` line.
2. Whether this specific unit is a heat pump (Mod=4 heat) or cooling-only —
   the protocol supports the field either way; only testing tells you if the
   hardware honors it.
3. Which of the "newer firmware extras" (`SlpMod`, `AntiDirectBlow`, `LigSen`)
   this unit actually reports.
