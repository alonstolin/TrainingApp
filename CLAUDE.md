# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-user offline iPhone PWA holding a strength + hypertrophy + 10K running program and logging every set, run and core session against it. Vanilla JS ES modules, **no build step, no bundler, and no runtime dependencies except one**: Leaflet 1.9.4, vendored and pinned in `vendor/leaflet/` and loaded lazily by `src/ui/map.js` only on screens that show a map. Do not add another. Deployed to GitHub Pages at `https://alonstolin.github.io/TrainingApp/` from `main`. The repo is public.

README.md carries the program design, the research behind it, and the rationale for the non-obvious engineering decisions. Read it before changing the program or the scheduler.

## Commands

```bash
npm test                                   # unit tests (node --test, no browser)
node --test tests/unit/schedule.test.mjs   # one unit file
node --test --test-name-pattern="deload" "tests/unit/**/*.test.mjs"   # tests matching a name
npm run test:e2e                           # Playwright, WebKit + iPhone 14 emulation; starts its own server
npx playwright test tests/e2e/sheet.spec.js            # one e2e file
npx playwright test -g "swiping"                       # e2e tests matching a name
npm run serve                              # http://localhost:4173/TrainingApp/ — same subpath as Pages
npm run build:sw                           # regenerate sw.js precache list + version stamp
npm run check:sw                           # fail if that list is stale (CI runs this)
npm run verify                             # check:sw + unit
npm run verify:live                        # smoke-test the DEPLOYED site in an iPhone browser
npm run shots                              # seed 6 weeks of data, screenshot every screen (SHOT_DIR=… to redirect)
```

**Run `npm run build:sw` before every commit that adds, removes or edits a served file.** The service worker precaches from a generated list; a file missing from it makes the app boot to a blank screen offline. `check:sw` catches drift and CI fails on it. `npm run deploy` does build:sw + commit + push.

After deploying, run `npm run verify:live`. It catches the failures that only exist in production: the `/TrainingApp/` subpath, real HTTPS, GitHub Pages cache headers, service-worker scope, and a full log-a-set-and-reload round trip. Pages takes ~30–60s to publish; poll `sw.js` for the new version string before running it.

## Architecture

### `src/core/` is strictly DOM-free

Everything hard lives here — schedule, prescription, progression, stats, calendar projection, GPS maths, update policy — and is unit-tested in Node with no browser. Keep it that way: no `document`, no `window`, no imports from `src/ui/` or `src/data/`. If logic needs testing and touches the DOM, extract the decision into core (see `core/updates.js` for the pattern).

### The program is static, versioned content

`src/program/program.v3.js` is the current program and is never written at runtime; `program.v1.js` carries `version: 2` and stays as the record old sessions ran under (`PROGRAMS` in `program/index.js`). Every logged session freezes its own `prescriptionSnapshot` plus the program version it ran under, so the program can be edited freely without rewriting what past sessions said to do. **Bump `version` on any edit.** Exercises are referenced by permanent `id` slug — never rename or delete one; set `retired: true`. The spec the program implements is `research/SYNTHESIS.md`; program changes go through the research agents in `.claude/agents/` first (Sonnet researchers, Opus reviewer).

### v3 engine invariants

- **Heavy days are `probe_backoff`**: the probe is a measurement, the three back-offs at 80% of a block-reference e1RM are the dose. `blockReference()` in `core/progression.js` folds the heavy-day history (rows carry `role` and `isDeload`); the reference only moves on evidence, and a back-off raise is anchored on the load actually lifted so the bar moves by exactly one step after rounding. `tests/unit/reference.test.mjs` pins every rule, and `prescribe.test.mjs` asserts every generated back-off's implied RPE lies in [6.5, 8.5] — the reviewer's blocker. Pull-ups compute everything on system mass (`loadFromReference` hands back the belt load).
- **Week modifiers are keyed by role** (`probe` | `test` | `deload`), not week number. `mesoState()` in `core/schedule.js` derives the role: during the 10K build the lifting week is the run week as of Monday, deloads land on the running down-weeks, and a 14-day gap in long runs falls back to the lift count. The calendar's forward simulation calls the same function, so Today and Calendar cannot disagree. `meta.v3StartedAt` is the one-time entry marker written by `store.init`.
- **Core is attached at resolution** to the days in `program.core.attachTo` as entries with `group: 'core'`; `coreCompleted` counts any completed session with logged core work (`hasCoreWork`). The lift logger is metric-aware per entry (`weight_reps` | `reps` | `time` | `weight_time`); there is no separate core logger.
- **`resolveBlock()`** resolves one block and is what `store.reresolveEntry` uses for substitutions and station changes — keep it the only place a block becomes planned sets.
- **`sessionIntegrity()`** (`core/schema.js`) is read-only and strict only against the program version the session ran under.
- **Gym scoping** lives in `makeHistoryLookup`: for `gymSpecific` exercises (cable/machine/smith) the lookup runs exact station → same gym → anywhere and labels the hit `scope`. Sessions carry `gymId`, entries carry `station` and `swappedFrom`; `meta.substitutions[gymId]` are standing swaps applied in `resolveLiftSession`. Never chart two gyms on one line (the exercise screen filters per gym).

### The schedule is cursor-driven, not calendar-driven

`deriveCursors()` in `core/schedule.js` derives your position from the session log on every read — nothing is stored. The lift cursor advances when a session is completed or skipped; the mesocycle week advances only on completions, so skipping cannot fake a deload. Missing a day never loses a session; the Today screen offers the next thing owed. Future dates in the Calendar tab are therefore **projections**, flagged `projected` so the UI never renders a forecast as fact.

### Progression lookups are scoped by `dayKey` and skip deloads

`makeHistoryLookup()` filters history by the day the exercise was performed on, because every main lift appears twice a week under different schemes (heavy top-set vs volume). Without that scope the heavy day reads the volume day's sets, finds no top set, and silently restarts from zero. Deloads are also excluded from the progression basis or every block would reset ~15% backwards. **Moving an exercise between days orphans its history** — set `historyAliasDayKey` on the block (see `split.test.mjs`).

### Adjacent lift days share no primary muscle

`liftCycle` is ordered so that no two consecutive days — including the wrap-around, which is only 24h under the template — share a hard-trained muscle. `tests/unit/split.test.mjs` asserts this with a narrow allowlist. Reordering the cycle or moving exercises must keep that test green. `overlapWarning()` guards the runtime case where falling behind compresses two days together.

### Storage

IndexedDB, one record per session, all loaded into memory at boot (`src/data/store.js`). Every UI read is a synchronous lookup. Writes are debounced but serialised through a single chain so `await flush()` waits for everything in flight — `pagehide` is the only unload event iOS reliably fires, and it tears the page down immediately after. Backup is JSON export/import; there is no server and no account.

### Maps and routes

`src/ui/map.js` owns Leaflet: `loadLeaflet()` injects the vendored script once; `createMap(container)` returns the three layers the app draws (route dashed, track solid, position dot). Map containers are usually created before they are attached, so the wrapper watches the container with a ResizeObserver and replays a deferred `fit` — do not call Leaflet directly from a screen. Tiles come from two key-free hosts and are the only cross-origin requests the app makes; `sw.js` caches them in `training-tiles-v1` (cache-first, FIFO-trimmed, kept across app updates). Route maths is DOM-free in `core/routes.js`; routes live in their own IndexedDB store (`DB_VERSION 2`) and in the backup envelope. In e2e, abort the tile hosts with `page.route` and drive the planner through `window.__planner` — emulated touch never reaches Leaflet's handlers.

### Service worker and updates

Cache-first, precache-everything, `updateViaCache: 'none'` (GitHub Pages serves `sw.js` with `max-age=600`). `registerSW()` in `src/main.js` must check `reg.waiting` at startup, not just listen for `updatefound` — a worker that already installed never re-fires that event, and relying on it stranded the app on an old build once. Updates apply themselves at launch and only prompt mid-workout (`core/updates.js`).

### UI conventions

- Input is steppers and chips; the keyboard never opens by default. **Never snap typed input to the stepper grid** — that turned an entered 6.25 into 7.5. `+`/`−` move by the step from wherever the value is.
- Bottom sheets (`src/ui/sheet.js`) dismiss by swipe, backdrop tap or Escape. Sheets live in `#sheet-host` outside `#app`, so any handler that navigates **must close the sheet first** or its backdrop swallows every subsequent tap.
- Screens export `mount(root, params)` and return `{ unmount }`; register teardown via `ctx.onTeardown` for anything the router can't see (GPS watches, wake locks).
- Charts never use a dual y-axis, and never plot two different kinds of thing on one line — heavy and volume lift exposures, easy and long runs, are separate series.
- Sheets do not nest: opening a sheet clears `#sheet-host`. A stepper inside a sheet must pass `allowKeypad: false` or its keypad replaces the sheet it sits in.

### Testing notes

- Under WebKit touch emulation `page.mouse` produces **no events**; drag gestures in e2e tests dispatch real `PointerEvent`s (see `sheet.spec.js`).
- GPS tests stub `navigator.geolocation.watchPosition` via `addInitScript`. Fix timestamps must advance at a plausible pace — `core/geo.js` rejects implausible speeds, so emitting 9m-apart fixes 20ms apart looks like teleporting and every point is (correctly) dropped.
- `tests/unit/geo-accuracy.test.mjs` simulates runs with **autocorrelated** GPS error and asserts recorded distance against a known truth. White noise would overstate the problem and flatter any filter; a 400m track is included because over-smoothing shows up there as under-reporting.
- `tests/unit/_fixtures.mjs` has session/set builders and the loaded program (`program` is v3, `v2` the legacy file).
- e2e specs that start a pull-up day must accept the bodyweight sheet first (`acceptBodyweight` helpers in the specs). Seeding lifts programmatically goes through `store.cursors()` for the role and `resolveSession` with `{ role, coreCompleted, historyFor, bodyweightKg }` — see `deload.spec.js`.
