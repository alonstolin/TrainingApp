# Movement Asymmetry from a Barbell Press Clip — Criteria (Mode A extension)

Builds on `research/physique-metrics.md`, whose conclusions stand and are not re-derived. That file concluded a static pose cannot support a symmetry claim because nothing in the frame fixes the subject's rotation. This file asks what a barbell in the subject's own depth plane changes. Criteria only: no assessment of any athlete, no loads, no capture contents. Worked examples from a real clip belong in `coach/reports/`.

## Evidence access, stated first

- **Opened and read:** Validation of marker-less barbell auto-tracking (PLOS ONE 2022, via PMC8797250); the deadlift weight-distribution symmetry study (Frontiers Sports Act. Living 2020); the systematic review of inter-limb strength-asymmetry thresholds (JSSM 20:594); the interlimb leg-press reliability study (PMC13243393).
- **Search-summary only, primary not opened** (paywall, 403, or reCAPTCHA wall): Sato & Heise 2012 (JSCR); Yoon et al. 2026 (squat tilt feedback); the 2021 *Symmetry* bench-press shoulder-kinematics paper; the Kinovea validity papers; the bilateral-index bench study; barbell-velocity variability studies; the 2D markerless frontal-plane study. Each is tagged **[secondary, unverified primary]** where used.
- **Everything in the geometry sections is my own derivation**, marked **[derived]**. The algebra I trust. Every number that depends on a phone's real optics is an assumption until the null tests in section 5 are run on the actual phone.
- About 16 searches. I found **no study that measures bar tilt in an overhead press, validates a phone-video tilt measurement, or reports a normal range for press bar tilt.**

## Summary

1. **The bar buys a lot, but less than it first appears.** It fixes *camera-versus-bar* orientation, because the bar is a rigid straight line in the plane of interest. It does **not** fix *bar-versus-trunk* orientation, so every body-landmark measurement (trunk lean, shoulder height) keeps all the confounds from the physique file.
2. **The best single quantity is signed bar tilt (roll) of the line through the two sleeve axes, referenced to the same bar sitting level on the rack hooks.** It is measurable to roughly **0.1–0.2° digitising error** [derived], which is far below any plausible real signal. Digitising error is not the limiting factor.
3. **The limiting factor is a geometric artefact the bar itself introduces.** If the bar is yawed relative to the camera (camera misaligned, or the lifter pushes one side forward), a level bar appears tilted by about **(height of bar above lens axis ÷ distance) × yaw** [derived]. For 5° of yaw, a 0.5 m height offset and 3 m distance, that is about 0.8°. Because it scales with bar height, it **changes through the rep and contaminates the rack-to-lockout change measure**. "Change in tilt is self-referencing" is only true for constant offsets (camera roll, level of the floor).
4. **The bar also contains its own yaw gauge.** The apparent diameter ratio of identical plates left versus right gives bar yaw to roughly 0.5–1° [derived, untested]. That lets the artefact be estimated and subtracted, or at least bounded, from the same video. This is the most useful new idea here and also the least validated.
5. **Lens distortion mostly does not matter for a centred bar.** Radial distortion is symmetric about the image centre, so it shifts both ends equally. It matters when the bar is off-centre or an ultra-wide lens is used (up to about 1° [derived]).
6. **No literature gives a normal range or a threshold.** The frameworks are real (bar-tilt and ground-reaction-force coupling in squats, 2D video tracking validity, inter-limb asymmetry methodology) but were built for squats, snatches and leg press. The honest convention is **the athlete's own null clips plus within-set and between-session spread**, as with the tape.
7. **A pressing asymmetry would not license any conclusion about muscle size, and it would not say which side is the weaker one.** Argued in section 6.
8. **Lockout timing, per-arm timing and lateral drift are rejected or demoted.** Reasons in section 1.
9. **Frame extraction at 1 fps is unusable for this.** A press ascent lasts about a second. The measurement must be made on coordinates of tracked markers in every frame, not by looking at stills. Details in section 5.
10. **The posing clip and the lifting clip answer different questions. Both stay.** The lifting clip replaces nothing in `coach/PHYSIQUE.md`.

---

## 1. What is measurable from a frontal barbell press clip

Geometry for all of this, **[derived]**. Let the bar's two sleeve axes be points at the same height when level. A camera at distance Z, with its lens axis at height h below the bar, views the bar.

- **Roll** (bar tilted in the frontal plane, one end higher): appears as image tilt almost one-for-one. This is the signal.
- **Yaw** (bar rotated about the vertical, one end nearer the camera): the near end appears larger and displaced vertically away from the lens axis. For small yaw φ, apparent tilt ≈ (h / Z) · φ, where h is bar height minus lens height. It is zero when the lens is level with the bar and grows linearly as the bar moves away from lens height.
- **Camera roll** adds a constant to every tilt reading.
- **Camera pitch** (phone tipped up or down, no roll) leaves lines parallel to the image's horizontal axis horizontal, to first order. Pitch is not a tilt confound, but it moves the bar toward the frame edge.

| Candidate | Verdict | What it takes | Error it carries |
|---|---|---|---|
| **Bar tilt (roll) over the rep** | **Accept as the primary measure.** | Two high-contrast markers on the sleeve axes; per-frame coordinates; tilt = atan2(Δy, Δx). | Digitising about 0.1–0.2° (2 px per end over a 1000–1500 px baseline) [derived]. Constant offsets from camera roll and sloping floor. The yaw term above. |
| **Tilt change, rack/start to lockout** | **Accept, with two refinements.** (a) Reference to the bar on the hooks, not to the shoulder start. (b) Treat as unproven until the yaw term is bounded. | Same, plus a few seconds of the level bar on the hooks before unrack and after re-rack. | Cancels camera roll and floor slope. **Does not cancel the h-dependent yaw term.** The shoulder-rack start is itself a held posture with its own tilt, so "start" is not a zero. |
| **Left/right lockout height difference** | **Not a separate measurement.** It is the tilt at lockout times the baseline (1° over a 0.55 m hand spacing is about 10 mm; over a 2 m sleeve span about 35 mm). | Report as tilt degrees, with the centimetre figure at hand spacing for intuition. | Identical to tilt. |
| **Lockout timing difference between sides** | **Reject.** | The bar is rigid. End-to-end velocity differences are just the tilt rate, so there is no second independent signal. Per-arm timing needs elbow landmarks in a frontal view, where the angle near lockout barely changes and flare foreshortens it. Frame period is 17 ms at 60 fps. | Not worth the effort. |
| **Lateral bar drift** | **Demote to qualitative.** | Bar-centre x against a plumb line in the same plane. | Camera roll of 1° over about 0.7 m of travel produces about 12 mm of apparent drift [derived], comparable to plausible real drift. Needs a plumb line to be usable. |
| **Trunk lean** (frontal line, hip marker to shoulder marker, against vertical) | **Accept only as an explanatory variable for tilt, not a result.** | Skin-tape markers on both acromia and both iliac crests; hips must be in frame. | Landmark and soft-tissue error. Frontal trunk angle by 2D video is reported at roughly 2.7–2.9° minimal detectable change in gait [secondary, unverified primary; not lifters]. Needs a plumb or rack-upright vertical. |
| **Shoulder elevation difference** | **Reject as a standalone.** | Same markers. | Confounded by trunk lean and scapular position, exactly as in the physique file. Height difference of acromia is not a size or strength measure. |

Two further points:

- **Bar tilt is a position readout of a statically indeterminate system.** A level bar can coexist with unequal force sharing, and a tilted bar can come from trunk lean, scapular or thoracic position, or hand placement as well as from one arm lagging. I know of no measurement here that separates these. Section 6 uses this.
- **Signed consistency is more robust than magnitude.** The sign of per-rep tilt change over many reps and sessions needs no calibration of scale. A sign test is a cheap addition.

## 2. Which earlier confounds survive

| Confound | Effect on bar tilt | Status |
|---|---|---|
| **Subject yaw** (body rotated to camera) | None on the bar, which has its own orientation. | **Eliminated for bar variables.** Still fully present for trunk and shoulder landmarks. A trunk rotated against a square bar is a candidate real asymmetry the bar will not show. |
| **Camera yaw** | The bar's orientation relative to the camera drives the (h/Z)·φ term. | **Survives, now bounded and measurable.** Lens at bar height removes it at that height only. Because bar height changes about 0.7 m through a press, no lens height removes it across the rep. Camera distance helps (term scales as 1/Z). |
| **Real bar yaw during the lift** (one hand pushing ahead) | Indistinguishable from camera yaw in a single frontal view. | **Survives.** It is a genuine movement asymmetry, visible here only through the artefact. The plate-diameter ratio estimates it; a second camera would be needed to isolate it. |
| **Lens distortion** | For a level, **centred** bar the ends are mirror points and shift equally in y, so no tilt. For an off-centre bar the slope error is about 2·k·y₀·c (k = fractional corner stretch, y₀ = bar height from image centre, c = lateral offset, all in half-diagonal units) [derived]. Example: k = 2%, y₀ = 0.2, c = 0.15 gives about 0.07°. An uncorrected ultra-wide with k = 10%, y₀ = 0.3, c = 0.3 gives about 1°. | **Mostly cancelled for a centred bar on the main lens, which I assumed to have ≤2% residual (no spec found).** Use the main lens, never the ultra-wide, never digital zoom. Leave default lens correction on and record it. |
| **Parallax / lateral camera offset** | A camera offset sideways but aimed parallel to the rack sees both ends at equal depth, so no tilt. Panning the camera toward the bar, though, is camera yaw. | **Cancels if the camera is parallel, not merely centred.** "Aimed at the bar from the side" reintroduces yaw. Depth change as the bar moves (bar travels toward the face) scales both ends equally, so no tilt, but it changes lateral-drift scale. |
| **Plate alignment** | Plates are edge-on from the front. Different plate diameters make "top of the plate" a bad landmark. Unequal plate masses add a real torque. | **Survives as a real equipment effect.** Mark the sleeve axis with tape, not the plate edge. Swap plates or flip the bar end-for-end once as a control. |
| **Floor level / rack level** | Affects tilt relative to gravity, not tilt relative to the hooks. | **Cancelled by the hooks reference.** Matters only for absolute tilt and for lateral drift. |
| **Phone roll** | Constant offset on every frame. | **Cancelled in differences and by the hooks reference.** Not cancelled in absolute tilt. |
| **Stabilisation, horizon-lock and action modes** | Per-frame warps or auto-levelling could alter measured tilt. | **Unknown, per phone model.** I could not verify. Turn them off and test with the null clip. |
| **Rolling shutter** | Both ends are on nearly the same image row if the bar is near level, so they are exposed within microseconds of each other. For 2° of tilt the induced error is on the order of 0.1 mm [derived]. | **Negligible for tilt.** Matters for fast horizontal motion, not here. |
| **Motion blur** | Blurs both ends in the same vertical direction by the same amount. | **Reduces marker precision, does not bias tilt.** |
| **Bar flex under load** | Ends droop symmetrically. | **No net tilt.** |

## 3. The literature

The honest answer is the one you expected. The frameworks are real, none of them were built for this question, and none give a threshold.

| Source | Design, population | What it gives | Grade and transfer |
|---|---|---|---|
| Validation of marker-less barbell auto-tracking (PLOS ONE 2022; opened, PMC8797250) | Validation vs 3D mocap; n = 8 males, ≥3 years training, 160 snatches at 60–90% 1RM; 100 Hz, 1080p, camera 20 m away, sagittal. Displacement bias −0.001 to 0.001 m; ICC 0.97–0.999; forward-velocity limits of agreement ±0.138 m/s. | 2D tracking of a bar marker can be accurate to a millimetre when geometry is orthogonal. | Tier 4. **Transfer is weak:** 20 m, near-orthographic, sagittal. A 3 m frontal view is not orthographic, and the study validates position, not angle from a baseline. It supports "digitising is not the limiting factor", not "tilt is valid". |
| Sato & Heise, JSCR 2012 **[secondary, unverified primary]** | n = 28 trained (14 + 14, split by weight-distribution test), back squat at 60 and 75% 1RM; bar tilt and rotation and vertical ground-reaction-force symmetry. | Groups with unequal weight distribution showed more bar tilt and rotation. The only study I found coupling bar tilt to a force asymmetry. | Tier 4, **squat, not a press.** Tilt there reflects leg and hip asymmetry with a force plate underneath; a press has no equivalent ground truth. Magnitudes not obtained. |
| Yoon et al., 2026 (squat tilt feedback) **[secondary, unverified primary]** | n = 24 healthy; accelerometer alarm when bar tilted. | Tilt fell with feedback, and so did vertical-force asymmetry. | Tier 4. Squat. Implication: **tilt is partly a motor-strategy variable that responds to attention**, so it is not a pure trait readout. |
| Shoulder kinematics and symmetry across load, bench press (*Symmetry* 2021) **[secondary, unverified primary]** | n = 27; phase velocity, acceleration and ROM per shoulder across 55–100% 1RM. | Asymmetry in shoulder kinematics present across loads; left ROM larger at every intensity. | Tier 4. **A same-direction finding in every load for a whole sample is what an instrumentation or setup effect looks like.** I could not check whether it was controlled. Population details unknown to me. |
| Bilateral deficit in bench press **[secondary, unverified primary]** | Handball players; bilateral index vs load. | Power and velocity deficit grows with load; maximal force shows facilitation. | **Wrong question.** Bilateral deficit compares two-limb output with the sum of one-limb outputs. It says nothing about left versus right in a bilateral lift. |
| Symmetry index of vertical ground-reaction force in the deadlift (Frontiers 2020; opened) | n = 9 students with some deadlift experience; SI 6.94 at 85% vs 6.16 at 60% of 1RM. | Asymmetry in a bilateral lift is non-zero at all loads and slightly larger heavy. | Tier 4. Small n, no reliability reported for the SI. Supports the idea that asymmetry is load-dependent. |
| Systematic review of inter-limb strength-asymmetry thresholds (JSSM 20:594; opened) | 53 articles. 10–15% thresholds dominate; only 6 of 18 applying thresholds to original data gave Tier 1–2 support; of 12 indices only 4 give the same magnitude regardless of which limb is stronger. | Conclusion: pre-set thresholds "may be flawed"; use individualised ones. | Tier 1-adjacent (systematic review) for the narrow claim that universal thresholds are unvalidated. Strength, not kinematics; mostly athletes and rehab. |
| Interlimb leg-press reliability (PMC13243393; opened) | n = 25 recreationally active; SEM 2.9–7.5%, MDC 8.1–20.8%; only 16% showed consistent dominance across conditions and sessions. | Asymmetry in one task can reverse in another; measurement error often exceeds the 10–15% cutoffs. | Tier 3-4, leg press, not trained lifters, not kinematic. The reversals argument is directly relevant to section 6. |
| Barbell velocity variability (graded squat, elite weightlifters) **[secondary, unverified primary]** | Within-subject CV about 3.5–6% for velocity; variability lower near maximal load in elite weightlifters. | Rep-to-rep variability is real and load-dependent. | Velocity, not tilt. **I found no rep-to-rep tilt data.** |
| Kinovea validity, 2D body angles **[secondary, unverified primary]** | Reported valid within about 5 m at 45–90° camera angles; trunk-angle MDC about 2.7–2.9° in gait. | Order of magnitude for human-digitised body angles. | Not lifters; not bar tilt. |

**Net:** no validated method, no normal range, no threshold for press bar tilt. What generalises is the habit from the asymmetry review: individualise the threshold, and report variability alongside any asymmetry value.

## 4. What magnitude means anything

No literature value exists. The instrument terms are derivable; the biological term must be measured.

| Term | Size | Basis |
|---|---|---|
| Digitising error, tilt | ~0.1–0.2° | 2 px per end, ~1000–1500 px baseline **[derived]** |
| Lens distortion, centred bar, main lens | ≲0.1° | **[derived, assumed 2% residual]** |
| Yaw artefact | (h/Z)·φ: 0.8° for h = 0.5 m, Z = 3 m, φ = 5°. In the rack-to-lockout change: Δh·φ/Z, about 1° for Δh = 0.7 m. | **[derived]**, to be verified by the null test |
| Rep-to-rep variability within a set | **Unknown.** I expect it to exceed all the terms above, but that is an expectation. | No source |
| Session-to-session variability of the set median | **Unknown.** | No source |

**Therefore the decision rule must be built from the athlete's own data.** The same move as same-day tape repeat spread:

1. **Instrument floor.** From the null clips (section 5): the SD of tilt across frames of the static level bar, and the slope of apparent tilt against bar height from the two-height null. That slope is the empirical artefact coefficient for that phone and setup.
2. **Within-set spread.** SD of per-rep tilt change across ≥5 reps; SE = SD/√n.
3. **A set shows a tilt change if** |median change| exceeds the largest of (2 × SE within-set), the instrument floor, and the artefact predicted by the coefficient in (1) at the heights concerned. This is a convention, not a derived statistic.
4. **A pattern is "established" only when** the sign is the same in at least six sessions in a row (a sign test, p ≈ 0.03 two-sided at 6/6), or the mean of session medians exceeds 2 SE of the between-session spread. Fewer sessions give "suggestive". Convention.
5. **Re-set the camera from scratch every session** for those first sessions. A camera-yaw artefact then has a roughly random sign, whereas a real asymmetry tends to keep one. This reduces the camera explanation without excluding it, because setup habits are not random. Once the pattern is established, fix the setup for tracking change, which is the opposite requirement.
6. **Equipment control, once:** swap the plates side to side, or turn the bar end for end. If the tilt sign flips with the equipment, it was equipment.
7. **Load control, each session:** film a light set as well as the working set. Camera artefact and constant postural offset are largely **load-independent**; effort-related asymmetry grows with load. A tilt that is the same on a light set and a working set is not evidence of anything effort-related.

## 5. Capture protocol for a useful clip

Specific enough to follow without judgement calls. Everything here is convention supported by the geometry above, not by a validated protocol.

**Camera**
- Phone **landscape**, on a rigid tripod or mount. Main (1×) lens only. No ultra-wide, no digital zoom.
- **1080p at 60 fps.** 4K at 30 fps is acceptable. Not 240 fps.
- Turn off video stabilisation, action mode, cinematic mode and any horizon or auto-level setting. I could not verify which of these a given phone applies; the null clip will reveal it. Leave default lens correction on, and write down that it was on.
- Lock exposure and focus (tap-and-hold) before filming. Enough light that plate and marker edges are sharp when you pause on a frame.
- Use the phone's level to set camera roll at zero, and keep pitch near zero.

**Placement**
- Directly in front of the bar, on the rack's centre line, **about 2.5–3 m** away. Choose the distance at which the bar occupies **60–70% of the frame width** at rest, which leaves room for sleeves and drift.
- **Lens axis parallel to the rack, not aimed at the bar from an angle.** Verify with the yaw gauge below.
- Lens height about 1.5 m. The yaw term depends on the offset between bar and lens heights, and because the bar travels about 0.7 m no lens height removes it, so do not spend effort optimising this. What matters is that the frame holds the bar at both ends of its travel, and the head and hips if trunk lean is wanted.
- Mark tripod feet and floor position; the point is repeatability of the null, not precision of the first setup.

**Markers**
- A band of bright tape (different colour each side) around each **sleeve** just outside the collars, centred on the sleeve axis. Do not use plate edges.
- Optional, only if trunk lean is wanted: tape on both acromia and both iliac crests, bare torso or tight shirt.
- A plumb line (string and weight) hanging in the bar's plane, if lateral drift will be reported.
- Mark the grip with tape at equal distances either side of the bar's centre knurl ring, and use the same marks every time.

**Yaw gauge (check at setup, every session)**
- Before unracking, film 3 s of the bar resting level on the hooks. Measure the apparent diameter of the **outermost plate on each side** (identical plates required). Ratio 1.00 ± 0.01 corresponds to yaw within about 1° at 3 m [derived]. If outside that, nudge the camera and reshoot. The same measurement tracked through the lift estimates bar yaw frame by frame, which is how the artefact could be subtracted. **Untested; a candidate, not a method.**

**Null tests (once, then repeated after the camera is re-set)**
- Bar on the hooks at the **lowest and the highest hook position** the rack offers, 3 s each. Apparent tilt should be the same; any difference over the height difference is the artefact coefficient. Also deliberately yaw the camera about 5° each way and confirm the effect behaves as the formula predicts.
- Film the empty (or lightest practical) bar through a few reps to see the floor of what the movement itself produces.

**The set**
- **Same set in the session every time.** Use a submaximal working set (not a maximal attempt, where grind variance dominates), **at least 5 reps**, plus a **light control set** of 5 reps in the same session. Record both. Exclude any rep that grinds to a stop or is a failure rep, and say so.
- 3 s of the bar on the hooks **before unrack and after re-rack**.
- Same grip marks, same stance marks, same shoes, same time of day.
- Fatigue note: later sets in a session may show more asymmetry (the deadlift data above, n = 9, point that way [secondary]); the fixed-set rule is to keep this constant, not to remove it.

**Avoid**
- Ultra-wide lens; hand-held camera; a new camera position that is not recorded; loose clothing over the hips if trunk lean is wanted; mirrors in frame; another person crossing the line of sight; changing the plates' arrangement mid-protocol except for the deliberate swap control.

**Extraction rate (for the tool)**
- **1 fps is unusable.** The ascent of a press lasts roughly one second, so a 1 fps sample catches one arbitrary phase per rep, and a still read by eye cannot resolve a 0.5° tilt: over a 1000 px bar, 0.5° is under 9 px. I have not tested whether a vision model can estimate that; I would not rely on it.
- **The measurement should be computed from marker coordinates in every frame of the native clip** (a colour-threshold tracker writing x, y per frame for the two sleeve markers, and optionally plate diameters), with a few overlaid frames reviewed by a human to confirm the tracker found the right markers. Output per rep: tilt at the hooks reference, tilt at start, tilt through ascent indexed by **bar height**, not time, and tilt at lockout.
- If frames must be extracted for display, extract **only the rep windows** at 10 fps or more, and use them to check the tracker, not as the measurement.
- 60 fps native means about 1500 frames for a 25 s set; fine for a script, impossible to read frame by frame.

## 6. Would a pressing asymmetry license a conclusion about muscle size?

**No, and it would not even say which side is weaker.** Arguments, from strongest:

1. **Bar tilt is a position outcome, not a force readout.** The bar and two arms form a closed, statically indeterminate loop. A level bar can hide unequal force sharing; a tilted bar can come from trunk lean, scapular or thoracic position, hand placement, plate-mass difference or a motor habit. The sign of the tilt does not identify the laggard: the low side may be the weak side, or the side that is being compensated for.
2. **Force asymmetry is task-specific and unstable in direction.** In a healthy sample only 16% showed consistent limb dominance across conditions and sessions (PMC13243393, opened). The earlier physique file's strength-asymmetry paper (PMC9319678) found the dominant side advantage was only 3–6% on average and that many people were stronger or equal on the non-dominant side. If strength asymmetry flips with the task, a kinematic asymmetry in one lift is weaker evidence still.
3. **Strength is not cross-sectional area.** It also reflects neural drive, moment arms, tendon and technique, so even a clean *force* asymmetry would not give a size asymmetry. I found no study relating press bar tilt to limb girth or muscle area.
4. **It is responsive to attention.** Feedback reduced tilt and force asymmetry in the squat study [secondary], so tilt is partly a strategy.

What it *could* license is narrower and still an inference: a repeated, established tilt means the two sides may not share load equally in that lift, which is a hypothesis about differential stimulus, not a finding about size. That would be for `strength-coach` and `hypertrophy-coach` to weigh, and the natural independent check is a unilateral comparison (for example, single-arm dumbbell press reps at matched effort per side), not more video. A size claim needs the tape, with the caveats in the physique file.

## 7. Does this change `coach/PHYSIQUE.md`?

**No replacement; the two answer different questions and both stay.**

- The posing clip answers "is there a gross visible change or asymmetry". It still cannot support a symmetry claim, and this file does not change that.
- The lifting clip answers "does the bar tilt consistently in one direction, how much, relative to my own noise". It is a **movement-pattern** instrument for bar-level variables only.
- It should be its own capture on its own occasions (perhaps monthly, or when a movement concern arises), not folded into the weekly physique routine. The weekly protocol should not grow.
- **One optional borrowing, untested:** the plate-ratio idea suggests that a rigid, horizontal rod with identical markers at both ends, held in the body's depth plane in a posing frame, would give a yaw estimate the posing clip currently lacks. I have not worked that through; I would test it before adding it to a protocol.
- **Additions to the physique file's "what it tells you" section, if the lead agrees:** a line stating that movement asymmetry and size asymmetry are different claims and neither licenses the other.

## 8. Least sure of

- The h/Z yaw artefact: the algebra is simple, but I have not seen a phone clip confirm it. The two-height null on the actual phone is the first thing to do.
- Whether any phone mode silently warps video. Not verified for any model.
- Every number for rep-to-rep and session-to-session variability. There is no literature, and my expectation that biological variability dominates is unchecked.
- The plate-ratio yaw gauge, which is a derivation with no test.
- The sign-test rule (six consecutive sessions) is a convention to prevent over-reading, not a validated criterion.

## Sources

**Opened and read**
- Validation of video analysis of marker-less barbell auto-tracking in weightlifting, PLOS ONE 2022 — [PMC8797250](https://pmc.ncbi.nlm.nih.gov/articles/PMC8797250)
- High load/lower reps vs low load/higher reps, weight-distribution asymmetry in deadlifting, Front. Sports Act. Living 2020 — [10.3389/fspor.2020.560288](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2020.560288/full)
- The calculation, thresholds and reporting of inter-limb strength asymmetry: a systematic review, JSSM 20:594 — [jssm.org](https://www.jssm.org/jssm-20-594.xml%3EFulltext)
- Interlimb strength asymmetry is task-specific, multi-joint dynamometry — [PMC13243393](https://pmc.ncbi.nlm.nih.gov/articles/PMC13243393/)
- Strength asymmetries are muscle-specific and metric-dependent (from the earlier file) — [PMC9319678](https://pmc.ncbi.nlm.nih.gov/articles/PMC9319678/)

**Search-summary only, primary not opened**
- Sato & Heise 2012, Influence of weight distribution asymmetry on the biomechanics of a barbell back squat — [Ovid abstract](https://www.ovid.com/jnls/nsca-jscr/abstract/10.1519/jsc.0b013e318220e0a3~influence-of-weight-distribution-asymmetry-on-the?redirectionsource=fulltextview)
- Yoon et al. 2026, Reducing barbell tilt angle improves bilateral symmetry in GRF during back squats — [Springer](https://link.springer.com/article/10.1007/s12541-025-01413-4)
- Shoulder kinematics and symmetry at different load intensities during bench press, *Symmetry* 2021 — [MDPI](https://www.mdpi.com/2073-8994/13/10/1859)
- Bilateral index, power, force and velocity during bench press in handball players — [PMC10077126](https://pmc.ncbi.nlm.nih.gov/articles/PMC10077126/)
- Kinovea validity and reliability — [PLOS ONE 2019](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0216448&type=printable); trunk forward tilt angle by 2D analysis — [PMC10280343](https://pmc.ncbi.nlm.nih.gov/articles/PMC10280343)
- Barbell kinematics variability — [PMC5968951](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5968951/), [PMC10534034](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10534034/)
- 2D frontal and sagittal markerless motion capture — [PMC10635560](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10635560/)
- iPhone lens correction and distortion (tier 6, general commentary only) — [HowToGeek](https://www.howtogeek.com/iphone-camera-lenses-explained-what-do-wide-ultra-wide-and-telephoto-lenses-do/)

**Derived by me, not sourced:** all geometry in sections 1, 2 and 4 (yaw artefact, distortion slope error, rolling shutter, digitising error, plate-ratio yaw gauge).
