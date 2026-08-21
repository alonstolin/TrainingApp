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

**Your data lives only on this phone.** There is no server and no account. Deleting the home screen icon deletes every session you have logged, silently and unrecoverably. Use **Settings → Export backup** regularly; the app nags you after 14 days or 10 sessions.

---

## The program

### Week

| Day | Session | Why here |
|---|---|---|
| Mon | **Lower + Pull Volume** | Legs early, maximum distance before Saturday's long run |
| Tue | **Easy run** + core | Day after legs; easy running is active recovery |
| Wed | **Upper Push** — incline bench heavy | |
| Thu | Rest, or optional **bonus delt/arm** day / second easy run | The "5th session" slot. Never mandatory |
| Fri | **Upper Pull** — weighted pull-up heavy + core | |
| Sat | **Long run** + core | Fresh legs, five days clear of lower day |
| Sun | **Shoulders & Arms** — OHP heavy | Upper only, so long-run fatigue is irrelevant |

Those *days* are only a suggestion — miss a Wednesday, train out of order, train on a Sunday instead, and the schedule engine follows what you actually do (see *How the schedule works*).

The *order* is not a suggestion. **No two consecutive days in the cycle share a primary muscle**, and that is enforced by a test rather than by good intentions — see *Why the days are ordered this way*.

### The three strength lifts

Each gets **one heavy exposure and one volume exposure** per week:

| Lift | Heavy | Volume |
|---|---|---|
| Incline barbell bench | Wed — top set 4–6, then 3×6 @ 85% | Sun — 3×8–12 |
| Overhead press | Sun — top set 4–6, then 3×6 @ 85% | Wed — 3×8–10 |
| Weighted pull-up | Fri — top set 4–6, then 3×6 @ 85% | Mon — 3×6–8 |

Top sets progress by **double progression under an RPE target**: clear the top of the rep range at or under the week's RPE, and the load goes up (2.5kg on the bars, 1.25kg on pull-ups). Back-off loads are computed from the top set you *actually* hit that day, not the one that was planned.

### Mesocycle — 5 weeks

| Week | Accessory sets | Top-set RPE | Load |
|---|---|---|---|
| 1 | baseline | 7.5 | — |
| 2 | +1 on delts/arms | 8 | — |
| 3 | +1 more | 8.5 | — |
| 4 | peak | 9 | — |
| 5 | **deload** — half | ≤6 | ×0.85 |

Weekly direct sets on the priority muscles run 8 → 14 across the block for side delts, triceps and biceps, and 6 → 10 for rear delts — landing near the top of Renaissance Periodization's MAV band in week 4, then deloading.

### Running — 14 weeks to 10K

Two runs a week (easy Tuesday, long Saturday), plus an optional third on Thursday. Everything is Zone 2 / conversational.

Weeks 1–4 are **time**-based on purpose; chasing distance before you have tissue tolerance is how beginners get hurt. Distance targets take over from week 5. Long runs: 6.0 → 6.5 → 7.0 → *5.0 down* → 7.5 → 8.0 → 8.5 → *6.0 down* → 9.3 → **10.0**.

No long run ever exceeds ~110% of the longest run in the previous 30 days, and the app warns you if you try to log one that does.

### Core — 3 phases

Phases advance on **core sessions completed**, not on the calendar.

1. **Motor control** (sessions 0–11) — McGill Big 3: dead bug, bird dog, side plank, front plank.
2. **Capacity** (12–26) — longer holds, Pallof press, hanging knee raises.
3. **Loaded** (27+) — ab wheel, hanging leg raises, cable crunches, weighted planks.

No loaded spinal flexion until bracing endurance exists. The ab wheel is gated on a clean 60-second plank.

---

## The research behind it

| Decision | Basis |
|---|---|
| One heavy + one volume exposure per lift, not 3–4 | Grgic et al. 2018 meta-analysis: the frequency effect **disappears** once weekly volume is equated (p=0.421). Colquhoun 2018: 3× vs 6×/week bench, volume-matched, no difference. |
| Daily undulating periodization + RPE autoregulation | DUP favoured over linear for trained lifters (Rhea 2002). RPE/RIR scale validated by Zourdos 2016; operationalised by Tuchscherer's RTS. |
| Not conjugate / Westside | Nuckols, *Why I Wouldn't Westside* — insufficient volume and lift-specificity for raw natural lifters. |
| Side delts get the most accessory volume | RP volume landmarks (MEV 6, MAV 24). Least stimulated by pressing and pulling — whereas front delts and biceps are already covered by OHP and pull-ups, so they get less direct work by design. |
| Overhead triceps extensions are mandatory | The long head is only loaded in the stretched position; overhead extensions beat pushdowns for long-head *and* total triceps growth. |
| Stretch-biased curls (incline, preacher, Bayesian) | Preacher curls produce more distal bicep growth than incline curls via greater stretch loading; cable keeps tension where dumbbells go slack. |
| 5-week block (4 + deload) | RP: deload every 4–6 weeks. Helms: 6–9, autoregulated. Five suits a 4-lift + 3-run week. |
| Adjacent days share no primary muscle | Not because consecutive-day training is harmful — a 12-week volume-matched RCT found 24h vs 48–72h recovery made **no** difference to strength or size (p=0.075–0.974), and Schoenfeld/Grgic show frequency is volume-neutral. The reason is narrower: a heavy top set is worth less on a pre-fatigued muscle, and top sets are what drive all three goals. |
| Curls on lower day | The only slot in the cycle that neighbours nothing else pulling. Arm work does not interfere with legs, and it keeps biceps volume split across two non-adjacent days rather than piled into one session. |
| Long run kept 3+ days from lower day; all easy running Zone 2 | Wilson et al. 2012: interference scales with endurance **frequency and duration**, and running interferes more than cycling. Petré 2021 / Schumann 2022: the effect largely vanishes when the modalities sit on different days. Lift before run if they share a day. |
| Single-run distance capped at ~110% of the recent longest | Aarhus / BJSM 2025 (5,205 runners, 588k sessions): injury risk tracks **single-session spikes**, not weekly totals. A >100% jump carried 128% higher hazard. Better evidence than the folklore 10% rule. |
| Core starts with McGill Big 3 | Bracing endurance before any loaded spinal flexion. |

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
Pull   →  Delts/Arms  rear delts only, 3 light isolation sets
Delts  →  Lower       nothing   ← the 24h gap
```

`tests/unit/split.test.mjs` asserts this on every run, with a deliberately narrow
allowlist for the rear-delt case. Reordering `liftCycle` or moving an exercise
between days fails the suite rather than quietly reintroducing back-to-back
pull-ups.

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

## Gym-specific weight increments

Not every stack moves in 2.5kg steps. Open any exercise from Progress and set its
**weight increment** — a cable machine that goes 6.25 / 12.5 / 18.75 gets told so
once, and from then on it drives both the `+`/`−` buttons and the rounding of every
suggested load, so the app stops proposing weights that do not exist on it.

Independently of that, tapping the number on any stepper opens a keypad that takes
**any** value to two decimals. 6.25 is stored as 6.25.

## Running: stopwatch and GPS

The run logger offers three ways to fill itself in:

- **Stopwatch** — start/pause, screen kept awake, fills the duration.
- **Track with GPS** — live distance, rolling pace and a traced route, filling in
  both distance and duration. The route is drawn as a plain SVG outline with no map
  tiles, so it costs no network and works offline like everything else.
- **By hand** — the steppers, as before.

Two things worth knowing. **iOS suspends web apps when the screen locks**, so GPS
records nothing while the phone is off; the app holds a wake lock whenever it is
visible, and says so on screen rather than pretending otherwise. And phone GPS
wanders when you stand still — `src/core/geo.js` drops fixes worse than 25m,
movements under 5m, and anything implying a speed above 12 m/s, because unfiltered
jitter inflates a 40-minute run by 10–15% and takes the pace with it.

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
             dates · schedule · prescribe · progression · stats · schema · calendar · geo
  data/      db (IndexedDB) · store (in-memory + indexes) · backup
  program/   exercises.js · program.v1.js   ← the program, as data
  ui/        dom · chart · stepper · timer · sheet · toast · runtracker + screens/
```

The DOM-free rule on `src/core/` is what makes the schedule and progression logic testable in Node with no browser and no bundler.

### Editing the program

`src/program/program.v1.js` is static content and is never written at runtime. Edit it freely — every logged session stores a frozen `prescriptionSnapshot` plus the program version it ran under, so changing the program can never retroactively rewrite what past sessions said to do.

Two rules: **bump `version` on any edit**, and reference exercises by their permanent slug. Never rename an `id` or delete an exercise — set `retired: true` so old sessions still render.

### Two things to be careful with

- **`updateViaCache: 'none'`** on the service worker registration. GitHub Pages serves `sw.js` with `max-age=600`; without that flag the browser checks a cached copy of the worker and deploys land unpredictably.
- **Progression lookups are scoped by `dayKey` and skip deloads.** Both filters exist because of bugs that silently destroy progression: without the day scope the heavy day reads the volume day's sets, finds no top set, and restarts from scratch; without the deload filter, the session after a deload treats the deliberately-light deload load as the new baseline and resets you ~15% backwards every block. Moving an exercise between days hits the same trap — use `historyAliasDayKey`.
- **Never snap typed input to the stepper grid.** Doing so turned an entered 6.25 into 7.5, i.e. the app logging a weight that was never lifted. `+`/`−` moves *by* the step from wherever the value is; only float drift is rounded away.
