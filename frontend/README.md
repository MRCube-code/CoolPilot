# CoolPilot frontend

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (New York
style) + Framer Motion. Talks to the FastAPI backend in `../backend` — it
does not talk to the AC directly (see "Why the frontend never touches UDP"
below, this is the reason the Android story works at all).

## Setup

```bash
cp .env.local.example .env.local   # adjust if the backend isn't on localhost:8000
npm install
npm run dev
```

Needs the backend running first (`cd ../backend && uvicorn app.main:app --reload`)
— the app will show a connection banner instead of silently failing if it
can't reach it.

I could not run `npm install` / a real build in the sandbox this was built
in (no network access there) — see the root README's testing note. What I
could and did do: typecheck every file with `tsc` against ambient stub
module declarations (catches real syntax/type bugs in this code, can't
catch a wrong package API surface), and manually re-verify every backend
endpoint URL/method/body shape in `lib/api.ts` against `backend/app/main.py`
line by line. Run `npm run build` yourself before deploying — that's the
one check that actually needs real installed packages.

## Design

Brief called for HyperOS / Material 3 / Apple Home / SmartThings — soft
glassmorphism, generous rounding, dark+light, dynamic accent. Concretely:

- **Mode-reactive accent system** (`app/globals.css` `--accent-cool/heat/
  off/turbo/eco`): the whole UI tints cyan when cooling, amber when
  heating, slate when off. This is the signature element, and it's
  grounded in what the product actually does (temperature control), not
  decoration — see `lib/property-labels.ts`'s `accentForMode()`.
- **Temperature dial** (`components/temperature-dial.tsx`): a glass
  circular gauge, Apple Home/Nest-style, animated with Framer Motion,
  colored by the mode accent. The one deliberately "hero" UI moment;
  everything else stays restrained on purpose — this is a utility app
  people check dozens of times a day, not a landing page.
- **Glass surfaces**: one `.glass-surface` utility class (translucent +
  backdrop-blur + soft shadow), reused by Card/Dialog/Select/buttons
  rather than each component inventing its own translucency.
- **Typography**: Inter via `next/font/google`, tabular numerals on every
  temperature/stat readout so they don't jitter in width as they change.
  Deliberately not a second display face — a control app doesn't need
  editorial typography, and it's one less font to load.
- Tailwind v4's CSS-first config (`@theme` in `globals.css`, no
  `tailwind.config.ts`) — that's not a style choice, it's what Tailwind
  v4 actually requires; see the root-level research notes in this repo's
  git history / the version-check I ran before scaffolding this.

## Feature status — what's real vs. not

Every page that shows non-real data says so visibly in the UI itself, not
just here — but for a single reference:

| Page | Status |
|---|---|
| Dashboard | **Real.** Live status (polled from the backend's cache), real commands, real Smart Cool sequence with a resumable countdown. |
| Device Manager | **Real.** Actual discovery scan, bind, forget against the backend. |
| Automations | **Partially real.** Rules are created/stored for real (localStorage), and **time-based triggers actually fire** (checked client-side every 30s). Outdoor-temperature and presence triggers save correctly but never fire — there's no weather or presence data source yet. Also only runs while a tab is open; no backend scheduler yet. |
| Developer Tools | **Real.** Straight passthrough to `/api/diagnostics` and a raw command sender. |
| Energy | **Placeholder data**, clearly labeled in-page. Needs real measured runtime + your tariff. |
| Statistics | **Placeholder data**, clearly labeled in-page. Needs a real history of polled status. |
| Settings — temperature lock | **Real**, enforced on the Dashboard's +/- buttons. Not yet enforced in the Custom-mode dialog's slider (noted in-page). PIN is a non-cryptographic client-side deterrent, not real security — said explicitly in the UI, not just here. |
| Settings — language, notifications | **UI-only stubs**, labeled as such in-page. |

## Android — Capacitor

Browsers have no raw-UDP API — `fetch`/`XHR`/`WebSocket` are all TCP. That
was true before this project started, and it's why the FastAPI backend
does the UDP conversation with the AC (see `../backend/app/gree/`) and the
frontend only ever speaks HTTP to that backend (`lib/api.ts`). So wrapping
this in Capacitor doesn't need a native UDP bridge — the frontend was
never going to talk UDP in the first place, on Android or in a browser.

What's actually built for this, in this repo:

- `next.config.mjs` — `npm run build:capacitor` sets `CAP_BUILD=true`,
  which turns on `output: "export"` + `trailingSlash: true` (needed so a
  hard reload on e.g. `/devices` finds `devices/index.html` instead of
  404ing) + unoptimized images. Plain `npm run dev` / `npm run build` are
  unaffected — this only activates for the Capacitor build.
- `capacitor.config.ts` — `webDir: "out"`, `androidScheme: "https"`
  (Capacitor 8's own default, set explicitly so the origin
  `backend/app/main.py`'s CORS allowlist needs is documented, not implicit).
- `android-patches/` — Capacitor's Android template doesn't know our
  backend is plain HTTP, and Android blocks cleartext traffic by default
  (API 28+). `android-patches/apply.sh` adds a `network_security_config.xml`
  that allows cleartext specifically to `127.0.0.1`/`localhost`, nothing
  else. Run it once after `npx cap add android` (or let CI run it, below).
- `.github/workflows/android-build.yml` (repo root) — builds a debug APK
  in CI and uploads it as a workflow artifact. No Android Studio, no local
  SDK setup. Trigger it from the Actions tab (works from GitHub's mobile
  site) or push to `main`. See the root README's "Full Android app"
  section for the complete phone-only workflow: trigger the build, download
  the APK, install it, run the backend in Termux on the same phone.

**What I could not verify**: I don't have Android tooling in the sandbox
this was built in, so I never actually ran `npx cap add android` or
`./gradlew assembleDebug` myself — the CI workflow is my best-evidence
attempt (verified Capacitor 8's current defaults and GitHub's runner
image behavior via search first), not something I watched succeed. If
`./gradlew assembleDebug` fails on a version mismatch, the error message
will name the missing SDK/build-tools version — the workflow file has a
comment on exactly what to do with that.

**Real constraint, not a bug**: `NEXT_PUBLIC_API_BASE_URL` gets baked into
the static JS at build time. A static export has no server to read env
vars from later — so changing which backend the app points at means
re-running the build (or the GitHub Action) with a different value and
reinstalling, not editing a config file on the phone after the fact.

## Structure

```
frontend/
├── app/                    # routes: /, /devices, /automations, /energy, /statistics, /settings, /developer
├── components/
│   ├── ui/                 # shadcn primitives (button, card, dialog, ...)
│   └── *.tsx                # dashboard/device/automation/energy components
├── hooks/                  # polling, local-storage settings, smart-cool sequence, automation runner
└── lib/
    ├── api.ts              # every function here maps 1:1 to a real backend/app/main.py route
    ├── types.ts             # mirrors main.py's response shapes field-for-field
    ├── property-labels.ts   # mirrors backend/app/gree/properties.py
    └── mock-data.ts          # ⚠️ everything in here is fake, see the file header
```
