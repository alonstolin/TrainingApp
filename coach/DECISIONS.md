# Decisions

Dated. Newest first. Each entry says what changed, what data or evidence it
rested on, and where the detail lives. This is the memory of the program that
survives any chat.

## 2026-09-30 — The block reference is monotone (R1)

**What:** a test-week probe now seeds the next block's reference **only if it
exceeds the current one**. Otherwise the reference, its source, its date and the
stall counter are all left untouched and the seed is discarded. Three lines in
`blockReference()`, plus the direction written into SYNTHESIS §1.1, which had
been silent on it.

**Basis:** `research/REVIEW-reference-seeding.md` (program-reviewer, Opus), rated
MAJOR. Verified here by running it:

- The probe is prefilled at `round(reference / 1.1333)`, and that rounding goes
  down about half the time — so a test performed at **exactly** the prescribed
  load, reps and RPE seeded a lower reference (ref 100 → prefills 87.5 → seeds
  99.17). Being penalised for doing what the app asked is what proves the
  behaviour was unintended rather than a judgement call.
- The signal is inside the noise: 1 RPE ≈ 1 rep ≈ 2.9% of e1RM at 3 reps,
  against ~1% rating error (Helms 2017) and 1.25–3.33% CV for a proper 1RM in
  trained men. The observed drop was 2.8%, from one set taken at peak block
  fatigue and applied after the deload that resolves it.
- It blinded both regression detectors — §5.3(a) measures the probe against the
  reference, and the unconditional `stalls = 0` hid the stall it should count.
- Asymmetric loss decides it: a reference 3% high costs one visibly
  under-performed set; 3% low costs an undetectable sub-threshold block, which
  is the v2 failure v3 exists to fix.

**Applies retroactively.** The reference is derived from the log on every read,
never stored, so any past test week that pulled it down is undone the moment the
fix ships.

**Known gap, accepted:** R1 removes the engine's only downward path. §1.4's
"reset the reference 5% and rebuild" is prose the review tool prints, not code,
and the reviewer's R2 ("deload first, then confirm") depends on §5.3's reactive
trigger, which is not built. Until it is, genuine detraining should **prompt**
via the review flags rather than silently move loads.

## 2026-09-30 — Upper Pull: lat pulldown → straight-arm cable pullover (program v4)

**What:** Day C's third exercise changes from the lat pulldown to a straight-arm
cable pullover. Same prescription — 3 × 10–12 @ RPE ≤ 9, 120 s rest — only the
exercise changes. Program version bumped 3 → 4.

**Basis:** `research/pull-day-vertical-redundancy.md` (hypertrophy-coach). The
athlete noticed the day carried two vertical pulls. Several small EMG studies
converge that pull-ups and pulldowns produce essentially equivalent lat
activation — the pull-up adds elbow-flexor and trunk load, not more lat stimulus
— and Baz-Valle 2019 (trained, volume-matched) found exercise variation itself
adds nothing over a fixed selection. **No trial in any population** compares
pull-up-only against pull-up + pulldown for lat growth, so this is second-order;
the specialist said so rather than manufacturing a distinction, and rated its
confidence low-moderate on *which* fix.

The one thing that was not a toss-up: a **bent-arm** dumbbell or barbell
pullover is not a lat exercise (three independent EMG studies — it is pec- and
triceps-long-head dominant). Only the straight-arm cable version is, which is
why the exercise is named and cued the way it is.

**Effect:** back direct sets are unchanged at 12/week (it was the other option,
dropping the slot, that would have cut them). A biceps credit the day does not
need is dropped — five direct biceps sets follow it in the same session — and a
modest triceps-long-head contribution is gained, which is not counted in
`trains` because that field drives fatigue scheduling, not volume.

**Process note:** the Opus `program-reviewer` was **skipped by agreement** for
this one. `coach/README.md` says program changes go through it; this was a
like-for-like accessory substitution the specialist had already rated
second-order, with the one real hazard (bent-arm vs straight-arm) identified and
handled. Recorded here so the deviation is visible rather than assumed.

## 2026-09-30 — Physique assessment: agent and capture protocol

**What:** a sixth project agent, `physique-analyst`, plus a weekly capture
protocol (`coach/PHYSIQUE.md`) and `tools/physique.mjs`. It answers two
questions — what is lagging, what is asymmetrical — and briefs the specialists.
It changes nothing on its own.

**Decisions made while designing it:**
- **No in-app photo analysis.** The app has no server and the repo is public, so
  there is nowhere to put an API key. Capture happens on the phone's camera;
  analysis happens here, in the same loop as `/review`.
- **No computer-vision model.** Visual read of frames with a stated confidence.
  A silhouette measures width, and width is posture-confounded, so a model would
  buy precision without buying validity.
- **Per-side set logging declined.** This is the constraint that matters: arm
  and calf asymmetry has a tape number behind it, and torso/lat asymmetry has
  the frames alone. The agent is required to say so in every such finding.
- **Criteria before conclusions.** The agent's first job is research —
  `research/physique-metrics.md` — establishing by what metric a muscle counts
  as lagging and whether a validated asymmetry protocol exists at all (leads:
  photogrammetric postural assessment, the Limb Symmetry Index, ISAK girth
  measurement). Criteria invented by the lead would be exactly the unmeasured
  expert opinion this project already threw out once, when the RP volume
  landmarks turned out to cite nothing.

**Also:** `tools/review.mjs` now reports direct sets per muscle per week against
the §2.1 bands — the log half of "what is lagging", which it previously did not
compute.

## 2026-09-20 — Program v3 adopted

**What:** Replaced v2 with v3 as specified in `research/SYNTHESIS.md`
(revision 2, after `research/REVIEW.md`). Heavy days invert to a probe plus
back-offs at 80% of a block reference; volume days 3×6–8; accessories flat at
~8–10 direct sets with the last set to failure; legs to maintenance with a
split squat; 4-week blocks aligned to the running down-weeks during the 10K
build; run ladder from 5.5 km in ≤ 9% steps; spike rail at 10%; loaded core at
the end of Lower and Push; day D renamed "Shoulders & Triceps".

**Basis:** Five-agent research pass (four Sonnet specialists, one Opus
reviewer). The reviewer found a blocker in the lead's own synthesis — a
back-off band whose corner was past failure — which set the 80% figure.
The athlete brief is `research/BRIEF.md`.

**Open questions the data will answer** (review after one block):
- Tuesday easy run the day after legs: keep, or move to Thursday? Decided by
  logged CR10 and talk test on Tuesday vs Thursday runs (§4.3).
- Core placement: at the end of Lower and Push. Under 75% adherence means the
  placement is wrong again (§5.4).
- Whether the reference-anchored back-offs progress at ~one increment per block
  per lift (§1.4: one per block is success; two blocks without is a stall).

## 2026-09-20 — Features around the program

Gyms and stations (stack history per gym, per station; standing swaps),
exercise alternatives, routes on a real map with live position, and this
review pipeline. None change the program; all change what the review can see.
