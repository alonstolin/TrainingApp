# Training

An offline iPhone web app holding a strength + hypertrophy + 10K running program, and logging every set, run and core session against it.

Built for one person: an experienced natural lifter (10+ years) who wants to add weight to **incline bench press, overhead press and weighted pull-ups**, run a hypertrophy block around **shoulders and arms**, and go from a 10–15 minute jog to a continuous **10K** — while starting core training essentially from scratch.

---

**Live at → https://alonstolin.github.io/TrainingApp/**

## Installing it on your phone

1. Open **https://alonstolin.github.io/TrainingApp/** in **Safari** (not Chrome — only Safari can install a web app on iOS).
2. Tap **Share** → **Add to Home Screen**.
3. Open it from the home screen icon, not from Safari.

That last step matters. A home-screen web app gets its own storage, is exempt from Safari's 7-day eviction rule for unused sites, and runs full screen without browser chrome. It also works with no signal at all once installed — everything is cached on the device.

### Updating

Normally automatic: on launch, a downloaded update is applied and the app reloads
before you have touched anything. Mid-workout it waits and offers a pill instead,
since reloading would discard the set being entered.

If it seems stuck, **Settings → Maintenance → Check for updates** tells you what
version you are on and pulls a new one. **Force update** below it is the blunt
instrument — it unregisters the worker and clears every cache. Neither touches
logged training data, which lives in IndexedDB, not the cache.

A trap worth recording, because it strands the app on an old build with no visible
symptom: a service worker that installs and then sits in `waiting` does **not**
fire `updatefound` on subsequent launches — it already installed. If the only code
path that applies an update hangs off that event, the update never lands and the
old version serves indefinitely. `registerSW()` therefore checks `reg.waiting`
explicitly at startup, not just `updatefound`.

**Your data lives only on this phone.** There is no server and no account. Deleting the home screen icon deletes every session you have logged, silently and unrecoverably. Use **Settings → Export backup** regularly; the app nags you after 14 days or 10 sessions.

---

## The program

Version 3. The design was re-derived by a five-agent research pass (four specialist coaches, one adversarial reviewer) and the result is in [research/SYNTHESIS.md](research/SYNTHESIS.md) — every number below cites a section there. The athlete brief the research was written against is [research/BRIEF.md](research/BRIEF.md).

### Week

| Day | Session | Why here |
|---|---|---|
| Mon | **Lower + Pull Volume** + core | Legs early, maximum distance before Saturday's long run |
| Tue | **Easy run** (30 min) | Day after legs; whether that stays is decided from your own logged effort (§4.3) |
| Wed | **Upper Push** — incline bench heavy, + core | |
| Thu | Rest, or optional **bonus delt/arm** day / second easy run | Rest by default in test weeks and once the long run is 8 km+ |
| Fri | **Upper Pull** — weighted pull-up heavy | |
| Sat | **Long run** (+ optional core) | Fresh legs, five days clear of lower day |
| Sun | **Shoulders & Triceps** — OHP heavy, incline volume | Upper only, so long-run fatigue is irrelevant |

Those *days* are only a suggestion — miss a Wednesday, train out of order, train on a Sunday instead, and the schedule engine follows what you actually do (see *How the schedule works*).

The *order* is not a suggestion. **No two consecutive days in the cycle share a primary muscle**, and that is enforced by a test rather than by good intentions — see *Why the days are ordered this way*.

### The three strength lifts

Each gets **one heavy exposure and one volume exposure** per week:

| Lift | Heavy | Volume |
|---|---|---|
| Incline barbell bench (30°) | Wed — probe 1×3–5 @ RPE 8, then 3×4–6 @ 80% of reference | Sun — 3×6–8 @ RPE ≤ 8 |
| Overhead press (standing) | Sun — probe, then 3×4–6 @ 80% of reference | Wed — 3×6–8 |
| Weighted pull-up | Fri — probe, then 3×4–6 @ 80% of reference | Mon — 3×5–8 |

The heavy day is **inverted** from the usual top-set logic (§1.1). The first set is a *probe* — an honest 3–5 at RPE 8 — but the working stimulus is the three back-off sets at 80% of a **block reference** e1RM, never derived from that day's top set (the least reliably rated set in the session, Helms 2017). By the app's own RPE-adjusted Epley, 4–6 reps at 80% is RPE 6.5 → 8.5, and a unit test asserts every generated back-off lies in that band. The reference moves only on evidence: a later probe at ≤ RPE 8 that beats it, or every back-off set reaching 6 at ≤ RPE 8.5 — then the bar moves by exactly one increment (2.5 kg incline, dropping to 1.25 after two stalls; 1.25 kg OHP and pull-up). The test week's RPE-9 triple sets the *next* block's reference. Pull-up references and percentages are computed on **system mass** — bodyweight plus belt — which is why pull-up days ask for your bodyweight first.

### Mesocycle — 4 weeks during the 10K build, 5 after

Weeks have **roles**, not numbers:

| Role | Heavy day | Accessories |
|---|---|---|
| probe | probe @ RPE 8, 3×4–6 @ 80% | RPE 8–9, last set of each isolation exercise to RPE 10 |
| test (last loading week) | 1×3 @ RPE 9 — sets next block's reference | same |
| deload | 1×3 @ RPE 6, **2×4 @ 80%** — same percentage, fewer sets | half the sets, 90% load |

During the 10K build the lifting week **is** the running week (as of Monday), so lifting deloads land on the running down-weeks — run weeks 8, 12 and 16 (§4.4). A down-week with fewer than two loading weeks before it is skipped. If no long run is logged for 14 days the lift count takes over so the block cannot freeze; after the build, blocks are five weeks on the lift count.

Accessory volume is **flat**: ~8–10 direct sets per week each for side delts, triceps and biceps, 6 for rear delts, held across the block (§2.1, §2.2). No ramp — the trained-lifter trials nearest this volume found no benefit from adding sets, and the ramp stacked a volume peak on an effort peak. Legs are maintenance (~10 sets, one unilateral pattern kept for the running). The bonus day is two sets each, nothing to failure, probe weeks only.

### Running — 15 weeks to 10K

Two runs a week (easy Tuesday, long Saturday), plus an optional third on Thursday. Every run is easy: **CR10 effort 3–4 and a passed talk test**, both logged after every run — they are the one training variable that tracked injury in novice runners, and they decide whether the Tuesday run stays on Tuesday.

Weeks 1–4 are **time**-based on purpose. From week 5 the long run is distance-based and the easy run stays 30 minutes: 5.5 → 6.0 → 6.5 → *5.5 down* → 7.0 → 7.5 → 8.0 → *6.5 down* → 8.5 → 9.3 → **10.0**. Every step is ≤ 9% of the longest run so far and no weekly total rises more than ~20%.

The app checks two rails on every run, planned or just logged, GPS or typed: a single run more than **10%** over the 30-day longest (Frandsen 2025 — a dose–response, not a threshold, and *associated with* more injuries rather than the main driver), and a weekly total more than 30% over the previous week (Nielsen 2014). A previous lower-limb running injury — asked once — turns those warnings into stops. After the 10K: one 7–8 km easy run and one 4–5 km with strides.

### Core — loaded, at the end of Lower and Push

The mat programme was skipped, so it went. Core is now cable and bench work — one anti-extension, one anti-rotation, one anti-lateral movement plus gym-based foot work — and it rides at the end of the two shortest gym days rather than on its own (§5.4). Phases advance on core sessions completed (0 / 8 / 16): cable crunch, Pallof press and suitcase carries first; ab-wheel, woodchops and Copenhagen planks next; hanging leg raises, landmine rotations and heavier carries last. **Completion is tracked**; under 75% and the placement is wrong, not you.

---

## The research behind it

The current basis is [research/SYNTHESIS.md](research/SYNTHESIS.md), with the four specialist reports and the reviewer's audit alongside it. The table below keeps the decisions that survived that pass and records where the earlier reasoning did not.

| Decision | Basis |
|---|---|
| One heavy + one volume exposure per lift, not 3–4 | Grgic et al. 2018 meta-analysis: the frequency effect **disappears** once weekly volume is equated. Colquhoun 2018: 3× vs 6×/week bench, volume-matched, no difference. Two exposures are kept for the per-session volume ceiling, not for frequency itself. |
| Probe + reference back-offs instead of top set + derived back-offs | Androulakis-Korakakis 2021: an RPE-9 single alone did nothing; the same single plus back-offs at a fixed percentage did. Carroll 2019: daily rep maxes produced worse strength than submaximal relative-intensity work. v2's back-offs at 85% of an RPE-7.5 top set were ~66–74% 1RM — sub-threshold for a trained lifter. |
| Fixed progression ceiling, not a rising weekly RPE | Robinson 2024: strength gain is insensitive to proximity to failure across a wide RIR range; a rising ceiling clusters load increases on the fatigue-inflated last week. |
| Flat accessory volume, last set to failure | Enes JAP 2024 / Moreno 2024: in trained lifters near this volume, holding sets matched adding 30–60%. Refalo 2024: 1–2 RIR matched failure for growth with less velocity loss; the small failure-subgroup benefit in Grgic 2022 is why the last set still goes there. |
| Pull-up loads on system mass | Muñoz-López 2017, Sánchez-Moreno 2017: load–%1RM relationships hold on bodyweight + load and are wrong by a large factor on belt load alone. |
| Legs to maintenance, one lunge kept | Muscle is held on ~a third of building volume (Spiering 2021). Six of the eight slots in the one positive novice-runner injury-prevention RCT (Leppänen 2024) were hip and lunge work. |
| Adjacent days share no primary muscle | Not because consecutive-day training is harmful: the RCT once cited for this (Yang 2018) was 30 resistance-*untrained* men, lifting only. The reason is narrower — a heavy exposure is worth less on a pre-fatigued muscle, and those exposures drive all three goals. |
| Lifting deloads on the running down-weeks | On the old offset the RPE-9 week landed on the 10K and lifting deloads missed both running down-weeks — recovery paid for twice, out of phase. Fatigue is systemic; upper-body work is not impaired by running (Huiberts 2024, Sporer & Wenger 2003). |
| Weekly template kept, decided from data | The rotation proposed in research rested on a misread of Doma & Deakin 2013 (same-day strength *and* running) and was withdrawn. The athlete's own Tuesday-run effort decides it after one block. |
| Every run easy; spike rail at 10%; weekly rail at 30% | Frandsen 2025 (5,205 runners): > 10% over the 30-day longest, HRR 1.64, as a dose–response. Nielsen 2014: > 30% weekly jumps. Kluitenberg 2016: higher prior-week RPE → more injury. Bone fatigue life halves per 10% rise in strain, and speed raises strain more than distance (Warden 2021). |
| Interference is not the threat it was treated as | Schumann 2022: pooled interference on strength and hypertrophy ≈ 0. Wilson 2012's running-vs-cycling modality finding did not replicate. Nobody in the literature is a 10-year lifter, so the transfer is unknown. |
| Loaded core, no mat phase | No evidence requires a floor-based bracing phase before loaded trunk work in a healthy strong lifter — the gate is borrowed from LBP rehabilitation. Adherence is the binding constraint: a done loaded programme beats a skipped mat one by the whole effect size. If low-back symptoms ever appear, this flips to McGill-style isometrics regardless. |
| No RP volume landmarks | The MEV/MAV numbers the earlier version cited are unmeasured expert opinion; the RP article cites no studies. Weekly targets are now the synthesis's direct-set bands. |

---

## The Calendar tab

Shows the plan against real dates: the fixed weekly rhythm, a month grid, and the
coming week spelled out. Tapping any day gives the detail — for a future lift day,
the actual movements and rep schemes you'll be walking into.

The important distinction, and the reason this screen needed care: **past days are
facts, future days are forecasts.** Because the program is cursor-driven (below),
no future date has a session fixed to it — only a projection of what lands there
if the weekly template is followed from here. Solid dots are things that happened;
outlined dots are projections. Miss a session and everything after it shifts,
which is correct behaviour rather than drift, so the screen says so rather than
implying Wednesday is a commitment.

It also projects your 10K date from your current position in the run plan.

## How the schedule works

The obvious implementation — `week = floor((today − start) / 7)` — breaks the first time you miss a Wednesday: that session is silently lost, and "week 4, peak volume" arrives even though you have trained nine times.

So the calendar and the program are decoupled. Three **cursors** (lift, run, core) advance only when a session is completed or explicitly skipped — never by the clock:

```
weekInMeso = floor(liftsCompleted / 4) % 5 + 1
```

Week 4's added volume arrives after 12 lift sessions, not 28 elapsed days. Two counters per track: `position` advances on complete *or* skip (deciding what comes next), while `completed` advances only on complete (driving the mesocycle week) — so skipping cannot fake your way into a deload.

Cursors are **derived from the session log on every read**, never stored, so they cannot drift out of sync with it and an imported backup needs no reconciliation.

Miss Friday's pull day and open the app on Sunday: you are offered **Upper Pull**, labelled *scheduled Fri · 1 day behind*. Escape hatches on the Today screen: **Something else** (pick any session), **Skip** (recorded, visible in history, advances the cursor), and a catch-up prompt at 3+ sessions behind.

---

## Why the days are ordered this way

Three of the four lift days are upper, so some muscle repetition between adjacent
days is unavoidable unless the days are built to avoid it. The cycle is arranged
so that every neighbouring pair — **including the wrap-around**, which under the
Mon/Wed/Fri/Sun template is only 24 hours — shares nothing meaningful:

```
Lower  →  Push        nothing
Push   →  Pull        nothing   (antagonists)
Pull   →  Delts       rear delts only, 3 light isolation sets
Delts  →  Lower       nothing   ← the 24h gap
```

`tests/unit/split.test.mjs` asserts this on every run, with a deliberately narrow
allowlist for the rear-delt case. Reordering `liftCycle` or moving an exercise
between days fails the suite rather than quietly reintroducing back-to-back
pull-ups. Core is attached to Lower and Push at resolution time and does not
count — it is low-fatigue tail work 48 hours apart.

A title that does not match its exercises is a different kind of fault, and one
that memory is bad at. Every logged lift session is checked on read against the
program version it ran under (`sessionIntegrity` in `core/schema.js`): day key,
title and exercise list must agree, allowing for swaps and additions. A mismatch
shows as a pill in History and a banner on the session — never as a silent fix.

The schedule is cursor-driven, though, so falling behind can still compress a 48h
gap into 24h. The Today screen therefore checks the session it is about to offer
against what you actually trained in the last ~20 hours and offers a one-tap swap
to a day that collides with neither. It fires on fatigue cost, not muscle identity
— three sets of face pulls after three sets of reverse pec deck is an "overlap" on
paper that costs nothing, and a guard that cries wolf gets ignored.

### Moving an exercise between days

Progression lookups are day-scoped, so moving an exercise **orphans its history**
and silently restarts it from zero. Set `historyAliasDayKey` on the block to point
at the day it came from; the alias is consulted only when the current day has no
history, so it retires itself after one session.

## Two gyms, many cable stations

Cable stacks, selectorised machines and Smith bars are not the same weight from
one gym to the next — or from one station to the next inside a gym. So each
exercise in the catalogue says what its load is set on (`equipment`), and for
the stack-based ones history is kept **per gym and per station**: add your gyms
in Settings, pick the one you are at on the Today card (only asked when there is
a choice), and tag the station from inside the logger. The "last time" lookup
reads exact station → same gym → anywhere, and when it has to reach across to
the other gym it says so and offers the number as a guide, not a target.
Barbell, dumbbell and bodyweight work is shared across gyms; a barbell is a
barbell.

## Swapping an exercise

When the station is taken, **Swap exercise** in the logger offers the catalogue's
recommended substitutes first (same job, different equipment — selection among
close variants is second-order for growth, see SYNTHESIS §2.3) and then anything
grouped by muscle. The block's scheme stays; the load and "last time" come from
the exercise you pick. With a gym set, a swap can be made **always at this
gym** — a standing substitution applied whenever a session is resolved there
and listed under the gym in Settings. Once a set is logged on an entry the swap
closes and **Add exercise** appends instead, so history is never rewritten.

## Gym-specific weight increments

Not every stack moves in 2.5kg steps. Open any exercise from Progress and set its
**weight increment** — a cable machine that goes 6.25 / 12.5 / 18.75 gets told so
once, and from then on it drives both the `+`/`−` buttons and the rounding of every
suggested load, so the app stops proposing weights that do not exist on it.

Independently of that, tapping the number on any stepper opens a keypad that takes
**any** value to two decimals. 6.25 is stored as 6.25.

## Routes on a real map

**Routes** (from a run's route card, or Progress → Running) plans a run on a
map: tap the corners of the streets you will run and the distance adds up live
at the top, next to the rung the plan wants next. Start from your current
location or from the first tap; drag a corner to move it, tap one to remove it;
**Close loop** and **Out & back** do what they say. Straight segments between
taps, deliberately — no road-snapping service, nothing to go down, and within a
few percent when you tap the corners. Saved routes are picked on the run screen,
prefill the distance, draw dashed under the live GPS track with your position
on top, and stay on the logged run.

The map is [Leaflet](https://leafletjs.com) 1.9.4, vendored in `vendor/leaflet/`
and precached with the app — the one exception to "zero runtime dependencies",
made because pinch-zoom on iOS is not something worth rewriting. Tiles are the
only network dependency the app has, and they come from OpenStreetMap, inverted
in CSS for the dark theme. (CARTO's dark basemap was the first choice and had to
go: it now answers unauthenticated requests with an "API KEY REQUIRED" tile.
OSM's own tiles are the one raster source that genuinely needs no account, which
is the property that matters in a public repo.) The service worker caches
every tile you view in its own bucket (600 tiles, oldest out first), so the
routes you actually run stay viewable offline; a tile never seen is a grey
square with the route still drawn on it.

## Reviewing the log

The app logs; `coach/` is where the log gets read. Export a backup from the
phone into `coach/data/backups/`, then `npm run review -- <file>` (or `/review`
in Claude Code) writes a Markdown report to `coach/reports/`: adherence, the
block reference after every heavy session, accessory stalls per gym and
station, every run against the spike and weekly rails, CR10 and talk test by
weekday, bodyweight drift, the reactive-deload conditions — and the program's
own rules applied to them mechanically. Every number comes from the same
`src/core/` modules the app runs. `coach/DECISIONS.md` is the dated record of
what was changed and why. Training data and reports are gitignored; the repo
is public.

## Running: stopwatch and GPS

The run logger offers three ways to fill itself in:

- **Stopwatch** — start/pause, screen kept awake, fills the duration.
- **Track with GPS** — live distance, rolling pace and a traced route, filling in
  both distance and duration. The route is drawn as a plain SVG outline with no map
  tiles, so it costs no network and works offline like everything else.
- **By hand** — the steppers, as before.

**iOS suspends web apps when the screen locks**, so GPS records nothing while the
phone is off. The app holds a wake lock whenever it is visible, and says so on
screen rather than pretending otherwise.

### Why the distance filtering is not trivial

A phone reports a position with a few metres of error, and that error *wanders*.
Sum the raw fixes and you measure the jagged path the receiver reported, not the
smooth one you ran — and a jagged line is longer. Standing at a crossing is worse
still: true distance zero, reported distance whatever the drift adds up to.

`tests/unit/geo-accuracy.test.mjs` simulates 8km runs over known paths with
autocorrelated GPS error and asserts the recorded distance. Measured error against
truth, averaged over 8 seeds:

| | raw sum | fixed 5m gate | shipped filter |
|---|---|---|---|
| open sky | +9% | +4% | **+1%** |
| partial obstruction | +20% | +9% | **+1%** |
| urban canyon | +63% | +41% | **+3%** |
| 400m track, urban | +60% | +38% | **−3%** |

The middle column is a cautionary tale, not a strawman — it is what this app
shipped first. A fixed 5m "minimum movement" gate sounds reasonable until you
notice that at 1Hz and 3.4 m/s a real stride is only ~3.4m per fix, *below* the
gate. It discarded genuine movement and kept only fixes that noise had pushed
further, selecting for the very thing it was meant to remove.

What works instead, in `src/core/geo.js`:

1. **Adaptive smoothing** — an exponential filter whose strength is set by the
   receiver's own reported accuracy. Clean fixes are barely touched; ragged ones
   are heavily averaged.
2. **Anchor gate** — distance is committed only once you are convincingly clear of
   the last committed point, scaled to that accuracy.
3. **Segment speed** — crossing that gate takes a runner ~2s and a phone on a
   bench ~30s, which separates travel from drift. Without it, five stationary
   minutes invent 50–130m.

Smoothing alone is not enough, which is why the track case is in the table: over-
smooth and you cut every corner, turning inflation into *under*-reporting. That
would be the worse bug — it makes you look slower than you were and compounds
into the 10K ramp — so a test asserts the error is not biased downward.

There is deliberately **no map and no route planning**. That was considered and
dropped in favour of tracking; adding a tile layer later touches none of this.

## Development

```bash
npm install          # devDependencies only — the app itself ships zero dependencies
npm test             # unit tests for src/core (node --test, no browser)
npm run serve        # http://localhost:4173/TrainingApp/  ← same subpath as GitHub Pages
npm run test:e2e     # Playwright, WebKit + iPhone emulation
npm run build:sw     # regenerate the service worker precache list + version stamp
npm run verify       # check:sw + unit tests
npm run verify:live  # smoke-test the DEPLOYED site (install reqs, SW scope, offline, logging)
npm run shots        # seed 6 weeks of data and screenshot every screen
npm run deploy       # build:sw + commit + push
```

`verify:live` is the one that catches production-only failures — the `/TrainingApp/`
subpath, real HTTPS, GitHub Pages cache headers, and the service worker registering
under a scope it does not own by default. Run it after any deploy.

**Run `npm run build:sw` before every push.** It regenerates the precache manifest and stamps a new cache version. Forgetting to add a new file to that list is the standard way a PWA boots to a blank screen offline, so the list is generated rather than hand-maintained, and CI fails if it drifts.

### Structure

```
index.html  manifest.webmanifest  sw.js  .nojekyll
src/
  core/      ← STRICTLY DOM-FREE. All the hard logic. Unit-tested in Node.
             dates · schedule · prescribe · progression · stats · schema · calendar · geo · updates
  data/      db (IndexedDB) · store (in-memory + indexes) · backup
  program/   exercises.js · program.v1.js   ← the program, as data
  ui/        dom · chart · stepper · timer · sheet · toast · runtracker + screens/
```

The DOM-free rule on `src/core/` is what makes the schedule and progression logic testable in Node with no browser and no bundler.

### Editing the program

`src/program/program.v3.js` is static content and is never written at runtime (`program.v1.js` carries version 2 and stays as the record older sessions ran under). Edit it freely — every logged session stores a frozen `prescriptionSnapshot` plus the program version it ran under, so changing the program can never retroactively rewrite what past sessions said to do.

Two rules: **bump `version` on any edit**, and reference exercises by their permanent slug. Never rename an `id` or delete an exercise — set `retired: true` so old sessions still render.

Program changes go through the research team in `.claude/agents/` (four Sonnet specialists, one Opus reviewer) and land in `research/SYNTHESIS.md` before they land here; `research/REVIEW.md` shows what that step catches.

### Two things to be careful with

- **`updateViaCache: 'none'`** on the service worker registration. GitHub Pages serves `sw.js` with `max-age=600`; without that flag the browser checks a cached copy of the worker and deploys land unpredictably.
- **Progression lookups are scoped by `dayKey` and skip deloads.** Both filters exist because of bugs that silently destroy progression: without the day scope the heavy day reads the volume day's sets, finds no probe, and restarts from scratch; without the deload filter, the session after a deload treats the deliberately-light deload load as the new baseline and resets you ~15% backwards every block. Moving an exercise between days hits the same trap — use `historyAliasDayKey`.
- **Never snap typed input to the stepper grid.** Doing so turned an entered 6.25 into 7.5, i.e. the app logging a weight that was never lifted. `+`/`−` moves *by* the step from wherever the value is; only float drift is rounded away.
