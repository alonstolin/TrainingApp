# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-user offline iPhone PWA holding a strength + hypertrophy + 10K running program and logging every set, run and core session against it. Vanilla JS ES modules, **zero runtime dependencies, no build step, no bundler**. Deployed to GitHub Pages at `https://alonstolin.github.io/TrainingApp/` from `main`. The repo is public.

README.md carries the program design, the research behind it, and the rationale for the non-obvious engineering decisions. Read it before changing the program or the scheduler.

## Commands

```bash
npm test                                   # unit tests (node --test, no browser)
node --test tests/unit/schedule.test.mjs   # one unit file
node --test --test-name-pattern="deload" tests/unit/   # tests matching a name
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

`src/program/program.v1.js` is never written at runtime. Every logged session freezes its own `prescriptionSnapshot` plus the program version it ran under, so the program can be edited freely without rewriting what past sessions said to do. **Bump `version` on any edit.** Exercises are referenced by permanent `id` slug — never rename or delete one; set `retired: true`.

### The schedule is cursor-driven, not calendar-driven

`deriveCursors()` in `core/schedule.js` derives your position from the session log on every read — nothing is stored. The lift cursor advances when a session is completed or skipped; the mesocycle week advances only on completions, so skipping cannot fake a deload. Missing a day never loses a session; the Today screen offers the next thing owed. Future dates in the Calendar tab are therefore **projections**, flagged `projected` so the UI never renders a forecast as fact.

### Progression lookups are scoped by `dayKey` and skip deloads

`makeHistoryLookup()` filters history by the day the exercise was performed on, because every main lift appears twice a week under different schemes (heavy top-set vs volume). Without that scope the heavy day reads the volume day's sets, finds no top set, and silently restarts from zero. Deloads are also excluded from the progression basis or every block would reset ~15% backwards. **Moving an exercise between days orphans its history** — set `historyAliasDayKey` on the block (see `split.test.mjs`).

### Adjacent lift days share no primary muscle

`liftCycle` is ordered so that no two consecutive days — including the wrap-around, which is only 24h under the template — share a hard-trained muscle. `tests/unit/split.test.mjs` asserts this with a narrow allowlist. Reordering the cycle or moving exercises must keep that test green. `overlapWarning()` guards the runtime case where falling behind compresses two days together.

### Storage

IndexedDB, one record per session, all loaded into memory at boot (`src/data/store.js`). Every UI read is a synchronous lookup. Writes are debounced but serialised through a single chain so `await flush()` waits for everything in flight — `pagehide` is the only unload event iOS reliably fires, and it tears the page down immediately after. Backup is JSON export/import; there is no server and no account.

### Service worker and updates

Cache-first, precache-everything, `updateViaCache: 'none'` (GitHub Pages serves `sw.js` with `max-age=600`). `registerSW()` in `src/main.js` must check `reg.waiting` at startup, not just listen for `updatefound` — a worker that already installed never re-fires that event, and relying on it stranded the app on an old build once. Updates apply themselves at launch and only prompt mid-workout (`core/updates.js`).

### UI conventions

- Input is steppers and chips; the keyboard never opens by default. **Never snap typed input to the stepper grid** — that turned an entered 6.25 into 7.5. `+`/`−` move by the step from wherever the value is.
- Bottom sheets (`src/ui/sheet.js`) dismiss by swipe, backdrop tap or Escape. Sheets live in `#sheet-host` outside `#app`, so any handler that navigates **must close the sheet first** or its backdrop swallows every subsequent tap.
- Screens export `mount(root, params)` and return `{ unmount }`; register teardown via `ctx.onTeardown` for anything the router can't see (GPS watches, wake locks).
- Charts never use a dual y-axis, and never plot two different kinds of thing on one line — heavy and volume lift exposures, easy and long runs, are separate series.

### Testing notes

- Under WebKit touch emulation `page.mouse` produces **no events**; drag gestures in e2e tests dispatch real `PointerEvent`s (see `sheet.spec.js`).
- GPS tests stub `navigator.geolocation.watchPosition` via `addInitScript`. Fix timestamps must advance at a plausible pace — `core/geo.js` rejects implausible speeds, so emitting 9m-apart fixes 20ms apart looks like teleporting and every point is (correctly) dropped.
- `tests/unit/geo-accuracy.test.mjs` simulates runs with **autocorrelated** GPS error and asserts recorded distance against a known truth. White noise would overstate the problem and flatter any filter; a 400m track is included because over-smoothing shows up there as under-reporting.
- `tests/unit/_fixtures.mjs` has session/set builders and the loaded program.
