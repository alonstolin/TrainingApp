# Program v3 — Synthesis (revision 2)

Written by the lead agent from the four specialist reports in `research/`,
then revised against `research/REVIEW.md`. Each decision cites the finding it
rests on as *file §section*. Confidence is the specialist's unless marked *lead
inference*. Conflicts between specialists are resolved in Part 6.

## Revision log — what the review changed

The reviewer opened seven primary sources and found the lead had not. Every
finding was accepted; none was argued down.

| Severity | Finding | Change |
|---|---|---|
| **Blocker** | Back-off band 3×4–6 @ 80–85% was arithmetically incoherent — 6 reps at 85% is RPE 10.7, past failure, by the app's own formula; the cited protocol did RPE ~4 triples at ~77% | **3×4–6 @ 80% of reference** (RPE 6.5 → 8.5 across the range); progress when all sets hit 6 at ≤ 8.5. Unit test asserts every generated back-off lies in RPE [6.5, 8.5]. |
| Major | The template rotation rested on a misread of Doma & Deakin 2013, whose exposure was same-day strength **and** running, not a run 24 h after legs | **Rotation withdrawn.** v2 calendar kept. Post-run RPE + Talk Test pulled into v3 so the Tuesday-run question is answered from the athlete's own data within one block. |
| Major | Cable/machine core was scheduled on the two non-gym days — the same adherence failure as v2 in different clothes | **Core moved to the end of Lower and Push**, the two shortest lifting days. Foot work made gym-based. |
| Major | Leppänen 2024 is a bodyweight/miniband/mat programme and cannot support a loaded cable core; the running and strength files contradict each other on whether strength prevents running injury | §5.4 basis rewritten to lead with adherence and the absence of a gate. Leppänen cited honestly. Contradiction added to Part 6. One unilateral hip exercise restored to leg day. |
| Major | "Holding volume produced *more* strength (Enes JAP 2024)" was a misread — group main effect, no interaction, 45% dropout | Struck. "No support for a ramp" softened. Evidence noted as quads/curls, not delts. |
| Major | v2 → v3 entry and the run-coupled calendar's failure modes were unspecified | Entry rule, decoupling rule, and run-cursor mapping test added (§4.4, Part 8). |
| Minor ×10 | Race-week upper maintenance; Schoenfeld 2017 label; Frandsen "threshold"; Huiberts "falls with status"; Coleman "never"; unilateral leg work; lift E unspecified; deload inconsistency; deferred features the rules depend on; no rest day | All applied — see the relevant sections. |

---

## What the research changed, in one screen

| | v2 (current) | v3 (proposed) | Basis |
|---|---|---|---|
| **Main-lift heavy day** | Top set 4–6 @ rising RPE, then 3×6 @ 85% *of today's top set* (≈ 66–74% 1RM, RPE 4–7) | **Probe** 1×3–5 @ RPE 8, then **3×4–6 @ 80% of a block-reference e1RM** (RPE 6.5 → 8.5) | strength §Q3, §Q4; REVIEW blocker |
| **Main-lift volume day** | 3×8–12 | **3×6–8 @ RPE 7–8** | strength §Q4 (specificity) |
| **Progression trigger** | Clear range at or under *this week's* RPE (rises 7.5 → 9) | All back-offs hit 6 reps **at ≤ RPE 8.5, fixed** | strength §"wrong" #2 |
| **Increments** | 2.5 kg bars, 1.25 pull-up | **Incline 2.5 (→ 1.25 after two misses), OHP 1.25, pull-up 1.25** | strength §Q5 |
| **Pull-up e1RM** | On added load | **On system mass** (bodyweight + load) | strength §Q6 |
| **Accessory volume** | 8 → 14 direct sets, ramped +1/+1/+2 | **Flat ~8–10 direct** (12–16 fractional) | hypertrophy §Q1, §Q2, §Q7 |
| **Accessory effort** | RPE cap 9–10, rising with the ramp | **RPE 8–9 all block; last set of each exercise to RPE 10** | hypertrophy §Q6 |
| **Legs** | 5 exercises, 14 sets | **Squat, split squat, RDL, calves — ~10 sets, maintenance** | hypertrophy §Q9; REVIEW minor |
| **Weekly template** | Mon Lower · Tue run · Wed Push · Fri Pull · Sat long · Sun S&A | **Unchanged** — decided from data after one block | REVIEW major |
| **Mesocycle** | 5 weeks, independent of running | **4-week blocks aligned to running down-weeks until the 10K; 5 weeks after** | concurrent §Q8 |
| **Deload** | Half sets, ×0.85 load, RPE 6 | Half sets; main lifts same % of reference at lower effort; accessories ×0.9; **prefer reduced-load to rest** | strength §Q9, hypertrophy §Q7 |
| **Run ladder** | Next rung 6 km (a 14–20% spike) | **Next rung 5.5 km**; every step ≤ 9%; down weeks ~80–85% | running §"wrong" #2, #3 |
| **Spike guard** | 1.15 | **1.10**, applied to every GPS-logged run | running §"wrong" #1 |
| **Run intensity** | "Zone 2", undefined | **Talk Test + CR10 RPE 3–4, logged**; no speed work until after the 10K + 3 months | running §Q4 |
| **Core** | Mat-based motor-control phase first | **Loaded, cable/bench, three movement families, at the end of Lower and Push** | strength §Q10; REVIEW major |
| **Post-10K running** | 5 km easy + 10 km long, forever | **7–8 km easy + 4–5 km with strides, ~12 km/week** | running §Q9 |

Two things the research **kept**, after trying to break them: RPE autoregulation with within-week intensity variation (strength §Q1), and every run on a non-lifting day (concurrent §Q6). A third was kept by the review: the v2 calendar itself.

---

## Part 1 — The three strength lifts

### 1.1 Invert the top-set logic

**Decision.** On the heavy day the top set is a *probe*: 1×3–5 at RPE 8 (2 RIR). The working stimulus is **3×4–6 at 80% of a block-reference e1RM**. Back-offs are never derived from the day's top set.

**Why 80% and 4–6.** By the app's RIR-adjusted Epley (e1RM = load × (1 + (reps + RIR)/30)), 4 reps at 80% is RPE 6.5, 5 is 7.5, 6 is 8.5. The range is therefore a double progression from RPE 6.5 to 8.5, and the trigger "all sets at 6 reps at ≤ RPE 8.5" is exactly the formula's own expectation. The reviewer found the earlier band (80–85%) contained a corner — 6 at 85% — that is RPE 10.7, past failure; the cited protocol's back-offs were RPE ~4 triples at ~77%. 80% sits between what was cited and what was first written, and inside the "~75–82% 1RM, RPE 6–8, 2–3 sets of 3–5" the reviewer reads the evidence as supporting.

**Basis.** In competitive powerlifters, a daily RPE-9 single alone produced no meaningful gain (6% probability); the same single plus back-off triples at 80% *of that single* produced a clear one (99.6%) — Androulakis-Korakakis 2021, T2, verified by the reviewer (strength §Q3). Training to a daily repetition max produced worse strength and RFD than submaximal relative-intensity work in well-trained men — Carroll 2019, T2. v2's back-offs at 85% of an RPE-7.5 top set land at ≈ 66–74% 1RM, RPE 4–7 — sub-threshold for a trained lifter (Androulakis-Korakakis 2020, T1) — and are anchored to the least accurately rated set in the session (Helms 2017). Confidence: **high** that v2's back-offs are too light; **moderate** that the reference-anchored replacement is right (it is heavier per rep than the cited protocol, lighter than the first draft).

**The block reference.** Week-1 probe e1RM, estimated only from sets ≤ 6 reps (Marques 2025, strength §Q8). It updates upward when (a) a later probe beats it at or under RPE 8, or (b) all three back-off sets reach 6 reps at ≤ RPE 8.5, in which case it rises by the lift's increment. The test week's RPE-9 set (§5.1) sets the *next* block's reference; it does not raise working loads on its own. If a probe comes in at RPE ≥ 9 unplanned, back-offs stay at 80% and stop at 3 sets — the dose is protected, not skipped.

### 1.2 Volume day: heavier, fewer reps

**Decision.** 3×6–8 at RPE 7–8 (≈ 72–80% 1RM) for incline and OHP; 3×5–8 for pull-ups.

**Basis.** Specificity: the volume day's job is load, and delt/arm hypertrophy is the accessories' job. Schoenfeld 2017 (T1) shows loads > 60% 1RM beat lighter loads for 1RM — but v2's 8–12 at RPE ≤ 8 is already ~70–76% 1RM, above that cut, so the meta-analysis does not distinguish 6–8 from 8–12. **No trial does, in trained lifters.** Confidence: **low–moderate** (T5 specificity; the strength coach's own caveat). Weekly direct sets per lift land at ~7–8, inside the 3–9 window that worked in competitive powerlifters (strength §Q2).

### 1.3 Fixed RPE ceiling for progression

**Decision.** The back-off trigger (§1.1) and the volume-day trigger (range hit at ≤ RPE 8) do not rise across the block.

**Basis.** Strength gain is insensitive to proximity to failure across a wide RIR range — Robinson 2024, T1 (strength §Q3). A rising weekly ceiling makes "clear the range at or under this week's RPE" easier each week, so load increases cluster on the fatigue-inflated week-4 set and the next block opens with a built-in miss (strength §"wrong" #2). Confidence: moderate.

### 1.4 Increments and expectations

**Decision.** Incline 2.5 kg (1.25 kg once a 2.5 kg jump has failed twice); OHP 1.25 kg; pull-up 1.25 kg on the belt. One increment per lift per block is success; two blocks without one is a stall.

**Basis.** The strongest quartile of competitive powerlifters gained ~0.10 kg/day on the three-lift total over 15 years — ≈ 12 kg/year per lift, less for upper-body — Latella 2020, n = 1,897 (strength §Q5). A 2.5 kg jump on a ~75 kg OHP is ~3.3%, roughly three months of expected adaptation at that rate. No micro-loading trial exists; this is arithmetic. Confidence: moderate.

**Stall protocol** (strength §Q5, in order, one block each): check running load and sleep → swap the heavy-day rep scheme (Plotkin 2022) → rotate the *volume-day* exercise to a close variant (Baz-Valle 2019) → reset the reference by 5% and rebuild in 1.25 kg steps → if two lifts stall together, one 4-week block-periodised mesocycle. **Prefer a reduced-load week to a rest week** (Coleman 2024, one trained-lifter trial, small effect, CIs crossing zero — moderate confidence, and the word "never" is not earned).

### 1.5 Pull-up: system mass

**Decision.** Log bodyweight on pull-up days — **this prompt ships in v3, not later.** Compute e1RM and every percentage on **bodyweight + added load**. When bodyweight moves ± 1.5 kg, recompute the reference and adjust the belt so relative load is preserved.

**Basis.** Load–velocity and load–%1RM relationships in the pull-up hold when load is expressed as system mass; computed on the belt alone they are wrong by a large factor — Muñoz-López 2017 (n = 82 trained), Sánchez-Moreno 2017 (strength §Q6). Confidence: **high**. The reviewer confirms the engine's e1RM already uses system mass; the audit in Part 8 covers every *percentage* path.

### 1.6 Lift-specific

- **OHP** standing, as the lift (specificity; no outcome trial on seated vs standing). Second press on incline-heavy day, first on its own. 1.25 kg default. No primary evidence on OHP–incline interference; if OHP lags incline two blocks running, make OHP first press in *both* sessions for a block (strength §Q7).
- **Incline** at 30° — peak upper-pec EMG *while keeping anterior-deltoid overlap with OHP lower than steeper angles* (Rodríguez-Ridao 2020, T4; 15° would overlap less still but at the cost of upper-pec involvement). Expect 6RM ~20% below flat; never compare (strength §Q8).

---

## Part 2 — Shoulders and arms

### 2.1 Count volume fractionally, and hold it flat

**Decision.** Weekly effective sets (direct + 0.5 × indirect) per priority muscle: side delts 12–16, rear delts 10–14, triceps 12–16, biceps 12–16. That is **~8–10 direct accessory sets per week, held flat across the block** — not 8 ramping to 14. No muscle exceeds ~11 fractional sets in one session.

**Basis.** Fractional counting won the model comparison in Pelland 2025 (35 hypertrophy studies, n = 1,032) with "strong/very strong" Bayes-factor support over both count-all and direct-only (hypertrophy §Q2). Once OHP, incline, pull-ups and rows are counted at 0.5, v2's "8 direct" is already ~11–15 fractional and week 4's "14 direct" is ~17–20 — a large hidden dose for a fatigue-sensitive lifter (hypertrophy §"wrong" #2). The dose–response is smooth with diminishing returns and no plateau; the efficient band is ~10–18 fractional sets (hypertrophy §Q1). RP's MEV/MAV/MRV landmarks the current program cites are unmeasured expert opinion — the RP article cites no studies (hypertrophy §"wrong" #1, confidence **high**).

**Why flat, not ramped.** In the closest population match — trained ≥ 3 y, squat ≥ 1.5× BW, habitual ~14 quad sets — holding volume matched adding 30–60% for hypertrophy (Enes JAP 2024: ΣMT 1.07 / 0.76 / 0.70 cm, no group difference); Moreno 2024 (curls) and a 2026 within-subject JAP study agree. The one ramp-positive trained trial (Enes MSSE 2024) started at 22 sets and climbed toward 52 — a fair contextual discount, not "no support". **The evidence is quadriceps and elbow flexors; nothing tests flat vs ramped for delts.** Confidence: moderate for the null; low for any delt-specific claim. *(The earlier claim that holding volume "produced more strength" was a misread of a group main effect — struck.)*

Per-session PUOS (~11 fractional sets per muscle) is the reason to keep two exposures, not a frequency mechanism the data can see (Remmert 2025; Schoenfeld 2019 volume-equated null — hypertrophy §Q4).

### 2.2 Effort: RPE 8–9, last set to 10

**Decision.** Accessories at RPE 8–9 (1–2 RIR) throughout the block. The final set of each accessory exercise goes to RPE 10. Volume and effort are never ramped together.

**Basis.** Hypertrophy rises continuously as sets approach failure (Robinson 2024) — but in the best trained-subject RCT, 1–2 RIR matched failure for growth with markedly less velocity loss (Refalo 2024, ≥ 3 y trained, verified by the reviewer; hypertrophy §Q6). Grgic 2022's small failure-subgroup benefit (ES 0.15) is the reason not to back off entirely. v2 stacks a volume peak on an effort peak in week 4 (hypertrophy §"wrong" #5). **Precedent the synthesis missed:** Enes JAP 2024's own protocol was exactly this — 2 RIR, last set of each exercise to failure. Caveats: Refalo is quadriceps, within-subject, in a deliberate energy surplus; applying it to isolation delt/arm work in an athlete who may run himself into a small deficit is an extrapolation the paper's own key points flag. Confidence: **moderate**.

### 2.3 Exercise selection: second-order

**Decision.** Keep one overhead triceps movement and one pushdown; full-ROM curls with progressive load, variants rotated for elbow health not "regional growth"; any lateral raise he can load progressively; reverse pec deck + face pull for rear delts. Laterals and rear-delt work 12–20 reps; arms 8–15 by exercise.

**Basis.** The only trained-subject multi-exercise RCT on lengthened partials found biceps and triceps thickness identical to full ROM (Wolf 2025, hypertrophy §Q3). Two untrained biceps RCTs testing shoulder position found no regional difference (Attarieh 2025; Frontiers 2026). The regional meta-analysis finds trivial effects (Varović SMD 0.04–0.09). Overhead triceps is the one lengthened-position result with a large effect (Maeo 2023 — untrained, but with a plausible biarticular mechanism). Cable vs dumbbell laterals are equivalent in 7-year-trained lifters (Wolf/Schoenfeld 2025). Rear-delt exercises have EMG evidence only — the program must not call them evidence-based picks (hypertrophy §"wrong" #4). Load is not a hypertrophy lever once sets are near failure (Lopez 2021; the only trained arm data favour *higher* reps for biceps — Schoenfeld 2015). Confidence: moderate-high that selection among these variants is second-order.

### 2.4 Legs to maintenance — with one unilateral pattern kept

**Decision.** Lower day: squat (or hack) 3×5–8, **split squat or reverse lunge 2×8–12**, RDL 3×8–10, standing calf raise 2×10–15 *slow and full-range*. Leg press and leg curl removed. ~10 sets.

**Basis.** 12+ direct leg sets is a growth dose competing with the long run, not maintenance (hypertrophy §"wrong" #7). Muscle is held at roughly one-third of building volume (Spiering 2021; Bickel 2011 — untrained, direction robust; hypertrophy §Q9). Calves stay for tibial bone-stress prevention (Warden 2014/2021, running §Q7). The unilateral pattern is the strength coach's explicit request (strength §Rec D iii): six of Leppänen 2024's eight injury-prevention slots were lunges, side lunges, abduction, bridges and hamstring work — that half of the programme is the half this athlete can keep, during "the riskiest 8–10 weeks of his running life" (running §Summary). The concurrent specialist independently reaches "legs are the flexible session; drop a set there, never on the priority lifts" (concurrent §Rec 3). Confidence: moderate.

Lower day order: **pull-up volume first**, then squat, split squat, RDL, curls, calves. The strength coach notes pull-up volume after squats loses reps; pull-ups do not fatigue legs. *Lead inference* from strength §"wrong" #8 and hypertrophy §"wrong" #8.

---

## Part 3 — Running

### 3.1 Fix the guard, fix the rung

**Decision.** `SPIKE_LIMIT` 1.15 → **1.10**, applied to every GPS-logged run including time-based ones. Next long run **5.5 km**, not 6.

**Basis.** Frandsen 2025 (BJSM, n = 5,205, 588,071 sessions; verified by the reviewer): a run > 10% longer than the longest in the prior 30 days carried HRR 1.64 for 10–30% over, 1.52 for 30–100%, 2.28 for > 100%. Weekly ratios and ACWR were null or *inverse* (running §Q2). The authors describe **a dose–response, not a threshold**: the 1–10% band had HRR 1.19 (NS), and they warn that "progressions up to 10% are not necessarily safe either" — chained 10% steps in one week may be excessive. ≤ 10% is where the increase stops being detectable, not where risk is zero. Also: 85% of overuse injuries in that cohort occurred in the *reference* state — the guard catches the spike-related minority; it is not the main safeguard. The app's threshold (1.15) sat inside the hazard band. v2's week-5 rung (6 km after a 5–5.25 km longest) is the *only* rung in the ladder that breaks the rule, at 114–120% — a conversion error from assuming a faster pace than his real 9 km/h (running §"wrong" #2). Confidence: **high** on the rung; **moderate** on the threshold's transfer (cohort median 9.5 y experience, BMI 24; no subgroup analysis possible).

Warning copy: "associated with more injuries" — not "the main driver". The novice Aarhus work (Nielsen 2013, 2014) points the same way and is the cited basis for a beginner.

### 3.2 The ladder from here

Weeks 1–4 unchanged (time-based, already run). From week 5:

| Wk | Easy | Long | Step | Note |
|---|---|---|---|---|
| 5 | 30 min | 5.5 km | — | now |
| 6 | 30 min | 6.0 | +9% | |
| 7 | 30 min | 6.5 | +8% | |
| 8 | 30 min | **5.5** | down | ~85%; **lifting deload** |
| 9 | 30 min | 7.0 | +8% vs 6.5 | |
| 10 | 30 min | 7.5 | +7% | |
| 11 | 30 min | 8.0 | +7% | |
| 12 | 30 min | **6.5** | down | ~80%; **lifting deload** |
| 13 | 30 min | 8.5 | +6% vs 8.0 | |
| 14 | 30 min | 9.3 | +9% | |
| 15 | 30 min | **10.0** | +8% | **goal** — legs light/none ≥ 48 h before; upper unchanged |
| 16 | — | — | — | lifting deload (block 3 ends); running to maintenance |

Every step ≤ 9% against the 30-day longest; three chained steps then a down-week. Down weeks at ~80–85% of the preceding long run, so no weekly total rises more than ~20% — under the > 30% weekly jump associated with distance-type injuries in 874 novices (Nielsen 2014, HR 1.59; running §"wrong" #3). Down-week cadence every 4th week matches the bone-remodelling timeline (Warden 2021, running §Q6).

**Easy runs time-based, long runs distance-based.** No evidence exists for either mode or a switch-over point (running §Q3). The guard is a *distance* rule, so distance is logged on every run regardless. A time-based easy run self-caps if he slows. *Lead adoption of the running coach's inference; no evidence either way.*

### 3.3 Intensity: all easy, operationalised and logged

**Decision.** Every run passes the Talk Test (a full ~10-word sentence without a breath pause, at any point) and lands at CR10 RPE 3–4; ≥ 5 on an easy run is an intensity error → walk 60 s and resume slower. Walk breaks do not fail a rung. **Both are logged after every run in v3** — they are also the data that decides the template question (§4.3). **No strides, pick-ups or tempo until after the 10K and ≥ 3 months of consistent running.**

**Basis.** The only novice cohort that measured intensity found higher prior-week RPE → more injury (Kluitenberg 2016, n = 1,696 — authors flag confounding; **moderate**). Bone fatigue life halves per 10% rise in tissue strain, and speed raises strain more than distance (Warden 2021). The polarised/threshold trials showing benefit are in runners 25 minutes faster over 10 km with 8-week bases (running §Q4). Talk Test and RPE are validated against VT1 (Bok 2022 — **high**). Confidence: high on the instruments; moderate on the injury argument for all-easy.

### 3.4 Body mass changes the timeline's *rigidity*, not its length

Body mass is a replicated injury risk factor in novice runners (Buist 2010: HR 1.15 per BMI unit in men; Kluitenberg 2015, n = 1,696; Nielsen 2013, n = 930) and vanishes in experienced runners (Malisoux 2020, SHR 1.00) — exactly what tissue adaptation predicts (running §Q2). Nobody has studied heavy *lean* novices. Consequence: no rung is skippable, no speed is added, and he stays at the conservative end of every rule for ~3 months. Confidence: moderate-high on the risk factor.

**Previous lower-limb injury** is the one predictor found in every cohort (HR ≈ 2–3). **One question at setup, shipped in v3.** If yes, every hold rule below gets stricter.

### 3.5 Frequency and the rest day

Two runs remain the plan. The optional third is 20–25 min easy, never a progression, used in lifting weeks 1–2 and deloads only, and the first thing dropped on any pain (running §Q5; concurrent §Rec 5). **Thursday is a rest day by default** in block week 3 (test week) and in any week the long run is ≥ 8 km — the app shows the optional slot as "rest" unless he opts in. Warden 2021: ≥ 1 rest day/week for bone.

### 3.6 Supporting factors with actual injury evidence

Three RCTs the current program ignores (running §Q7): a "land softer" gait cue — 12-month injury 16% vs 38% in 320 novices (Chan 2018, HR 0.38); cushioned standard-drop trainers (Malisoux 2020, hard midsole SHR 1.52 — NS in > 78 kg men, point estimate still favours cushioning); foot-intrinsic strengthening (Taddei 2020, control 2.4× more injured). Generic unsupervised hip/quad/core home programs did nothing in two RCTs and a pilot (Baltich 2017; Toresdahl 2020; Nguyen 2024). Warm-up and surface: no injury evidence; harmless.

### 3.7 After the 10K

One 7–8 km easy run + one 4–5 km with 6–8 × 20–30 s strides or 3–4 × 2 min comfortably hard, ~12 km/week. Intensity, not distance, is what maintains endurance (Hickson 1981 — untrained; Spiering 2021 narrative; running §Q9). Strides only after ~3 months of consistent running. Confidence: moderate.

---

## Part 4 — Putting lifting and running together

### 4.1 Interference is not the threat the program treats it as

**Finding.** Pooled interference on maximal strength and whole-muscle hypertrophy is close to zero (Schumann 2022: strength SMD −0.06, hypertrophy −0.01; 43 studies, n = 1,090). Where it exists it is lower-body: Huiberts 2024 (59 studies, n = 1,346; verified) finds lower-body strength in males −0.43 and **no detectable upper-body interference in any subgroup**. Prior aerobic work cuts leg-press reps 25% at 4 h and leaves bench press untouched (Sporer & Wenger 2003). His three lifts and all four priority muscles are upper-body (concurrent §Q1–Q3). Confidence: **high** that the program over-weights interference.

**The literature contains no one like him.** Huiberts found *zero* "highly trained" subjects across 59 studies. Petré's "trained" tier is team-sport athletes with minimal lifting experience and finds interference only there; **Huiberts tested for a training-status effect and found none** (P = 1.00 lower-body, 0.45 upper). Whether interference changes at his level is unknown.

**Consequences.** Do not reduce upper-body volume to "make room" for running. Ignore the running-vs-cycling distinction — Wilson 2012's modality finding did not replicate (Schumann, Petré; the 2024 network meta-analysis ranked moderate cycling *worse*). The remaining risks are systemic: sleep, energy balance, same-day proximity.

### 4.2 Three citations in the current program do not reach their use

- The 12-week "24 h vs 48–72 h, no difference" RCT used to argue adjacent-day overlap is fatigue management rather than recovery is Yang 2018: 30 resistance-*untrained* men, lifting only, no running (concurrent §"wrong" #4, confidence **high**).
- "Petré / Schumann separate-day" reaches the right conclusion from a mis-described population — the rule stands; the reason is fatigue, not molecular interference (concurrent §"wrong" #2).
- **Doma & Deakin 2013** — cited in revision 1 for "a run 24 h after a lower-body session is measurably impaired" — tested runners who did *both* strength and running the day before, 6 h apart. There was no legs-only-then-run condition; the authors' own conclusion concerns same-day combined training, which v2 already avoids. The concurrent file describes the 2012 companion correctly and the 2013 study incorrectly; the synthesis inherited the error. Withdrawn.

*Lead note: all three were my citations or my readings; the README will be corrected.*

### 4.3 The weekly template stays — and the Tuesday question is answered from data

**Decision.** The v2 calendar is unchanged: Mon Lower · Tue easy run · Wed Push · Thu optional/rest · Fri Pull · Sat long run · Sun S&A.

**Why the rotation was withdrawn.** It rested on Doma 2013 (§4.2). With that removed, the argument is inference plus a narrative review (abstract only); the specialist's confidence was already moderate-low. The reviewer identified costs the first draft did not weigh: a maintenance leg session 24 h after a long run reaching 8–10 km (untested), the priority-1 heavy incline 24 h after squats instead of after an easy run, the morning-after-long-run pain check coinciding with squat DOMS, and no mechanism for "no leg session inside 48 h of the 10K" when the cursor owes a Lower session the day after the race. The eccentric-damage mechanism the argument leaned on peaks at 24–72 h, so 48 h is not obviously better than 24 h on that mechanism either, and the repeated-bout effect in a 10-year lifter shrinks all of it.

**What decides it instead.** The athlete has been running Tuesdays after Monday legs for weeks. His own logged Tuesday runs — CR10 RPE and Talk Test, shipped in v3 (§3.3) — are the only evidence that exists. **Rule:** if, over one block, Tuesday easy runs are consistently RPE ≥ 5 or Talk-Test-negative while the Thursday optional runs (when taken) are not, adopt the conservative alternative the specialist rated *higher* than the rotation: easy run → Thursday, Tuesday becomes the non-running optional slot. Otherwise the template stays.

**What survives from the concurrent analysis regardless:** every run on a non-lifting day (Petré, Schumann, Robineau, Ratamess — all consistent); legs are the flexible session; heavy OHP the morning after the long run stands at the specialist's low-confidence "fine" (Leveritt 2000 in long-history lifters; upper body insulated).

### 4.4 Couple the calendars — with an entry rule and an escape hatch

**Decision.** For the remainder of the 10K build, lifting runs on **4-week blocks (3 loading + 1 deload) whose deloads land on the running down-weeks** (run weeks 8 and 12). Block 3 runs weeks 13–15 and deloads in week 16, after the race. **Race week (15): legs light or none ≥ 48 h before the 10K; upper-body sessions unchanged** — the concurrent file's own evidence says upper-body lifting does not impair running, and halving priority-1 work for priority 3 without evidence is the wrong trade. After the race: 5-week blocks (4 + 1) with a fixed deload and a reactive early trigger (§5.3).

**Entry rule.** v3 begins with a **probe week** regardless of run week. If the athlete is in v2 week ≥ 3 (RPE 8.5–9, +1/+2 sets), v3 begins with a **deload week** first, then the probe week. Block 1 then runs until run week 8. If that leaves fewer than two loading weeks before week 8, the week-8 lifting deload is skipped (the running down-week still happens) and block 1 runs to week 12.

**Escape hatch.** The lifting week is derived from the run week, and the run week advances only on a completed long run — so illness, a shin, or travel would otherwise freeze the lifting mesocycle with no deload arriving. **If no long run has been completed for ≥ 14 days, `weekInMeso` falls back to the lift-count clock** until running resumes.

**Run-cursor mapping.** `longCompleted + 1` puts him on v3 week 5 (5.5 km) or 6 (6.0 km), both ≤ his current longest. **Tested from both starting states**, because a wrong mapping would put him on 6.5 km — a 24–30% spike — and the rung fix is the highest-confidence change in the document.

**Basis.** On the current offset the RPE-9 lifting week lands on the 10K and lifting deloads miss both running down-weeks — recovery paid for twice, out of phase (concurrent §"wrong" #6, confidence **high** on the arithmetic). Fatigue is systemic (Wilson dose correlations; Doma 2012 same-day carry-over). Strength is maintained on very little if intensity is kept (Spiering 2021; Rønnestad). Only *lower*-body lifting impairs next-day running (Sporer localisation), so there is no evidence-based reason to reduce upper-body work before the race (concurrent §Q8). Confidence: moderate. Note the reviewer's arithmetic: with the race-week leg reduction, 4-week and 5-week blocks both give 8 loading weeks over run weeks 5–15 — the "one fewer loading week" cost claimed in revision 1 does not materialise.

### 4.5 Energy availability

**Flag, not a plan.** Resistance training in energy deficit loses lean-mass gains (ES −0.57) but not strength (Murphy & Koehler 2022); the cliff is ~−500 kcal/day. Two to three easy runs at his mass add ~900–1,800 kcal/week; unmatched, that is a chronic 130–260 kcal/day deficit — below the cliff, not nothing at his ceiling. **Rule:** roughly +100 kcal per easy km added to the week; weigh weekly; a downward drift > 0.5 kg over two weeks during the build is a nutrition signal, not a training one (concurrent §Q9). Dolan 2024 — the one null RCT in resistance-trained men — explicitly conditions on positive energy balance.

---

## Part 5 — Mesocycle, deload, core

### 5.1 Block structure during the build (4 weeks)

| Week | Main-lift probe | Back-offs | Volume day | Accessories | Legs | Thu |
|---|---|---|---|---|---|---|
| 1 | 1×3–5 @ RPE 8 | 3×4–6 @ 80% ref | 3×6–8 @ RPE 7–8 | flat, RPE 8–9, last set 10 | maintenance | optional |
| 2 | same | same | same | same | same | optional |
| 3 | **1×3 @ RPE 9 — test** | 3×4–6 @ 80% | same | same | same | **rest** |
| 4 | **deload:** 1×3 @ RPE 6 | **2×4 @ 80%** (RPE 6.5) | 2×6 @ RPE 6 | half sets, ×0.9 load | half | optional |

After the 10K: 5 weeks — weeks 1–3 probe, week 4 test, week 5 deload.

The RPE-9 test week is a *test*, not extra stimulus (Robinson 2024; Carroll 2019 — strength §Q4). No accessory-volume ramp (§2.1). No accessory-effort ramp (§2.2).

### 5.2 Deload content — one rule, stated once

Half the sets, same exercises and frequency. **Main lifts:** back-offs stay at 80% of reference (2×4 → RPE 6.5 by the formula); probe at RPE 6. **Accessories:** 90% of working load. *The reviewer found revision 1 specified two incompatible deloads; this is the one the engine implements.* Applying 90% to the main-lift back-offs would give 72% of reference for 4 reps — RPE 2, a warm-up — so the main lifts reduce sets and effort, not the reference percentage.

**Basis.** No controlled trial shows a reduced-load week improves outcomes in trained lifters; the only trained RCT tested a full *rest* week and it cost lower-body strength (Coleman 2024, n = 39, CIs crossing zero — **prefer reduced-load to rest**, moderate confidence; the trial says nothing about the cost of a reduced-load week). Practice (Rogerson 2024, n = 246 competitive strength/physique athletes) and expert consensus (Bell 2023 Delphi) converge on reduced-load. The deload's value is insurance for fatigue and for the running, not a growth mechanism (hypertrophy §"wrong" #6).

### 5.3 Reactive deload trigger (post-10K)

Deload the following week if (a) heavy-day e1RM on any lift is ≥ 3% below the block reference two heavy sessions running, or (b) the test week is missed on two lifts, or (c) joint pain or readiness is poor for a week — **with a hard ceiling of every 6th week** (strength §Rec C). **Until the trigger is built, this rule is applied manually** via the existing "Something else" / skip flow; the ceiling is enforced by the fixed block.

### 5.4 Core: loaded, at the end of Lower and Push

**Decision.** Two sessions per week **at the end of Lower and Push** — the two shortest lifting days (≈ 14 and 15 sets; core takes them to ~65 min). Ten to fifteen minutes, three movement families, one exercise from each, double progression, exercises rotated between blocks. A third session after the long run is optional. Deloads with the lifts. **Core completion is tracked; if block 1 shows < 75% adherence, the placement is wrong again.**

| Family | Block 1 | Block 2 | Block 3+ |
|---|---|---|---|
| Anti-extension / flexion | Cable crunch 2–3 × 10–15; kneeling ab wheel (partial) | Ab wheel full kneeling ROM; hanging knee raise | Hanging straight-leg raise; weighted decline sit-up 3 × 8–12 |
| Anti-rotation / rotation | Pallof press 2–3 × 8–12/side, 3 s hold | Cable woodchop high-to-low 3 × 8–12/side | Half-kneeling Pallof; landmine rotation 3 × 6–10/side |
| Anti-lateral flexion | Suitcase carry 2–3 × 30 m/side; cable side bend | Copenhagen plank on bench, knee level, 2 × 6–10/side | Copenhagen ankle level; heavier carries |
| Foot / ankle (gym-based) | Single-leg calf raise on a step, slow, full range, 2 × 10–12; single-leg balance holding the cable stack, 2 × 30 s | same | same |

**Basis — adherence first, then the absence of a gate.** The mat phase failed because he skipped it; an adherent loaded programme beats a skipped mat programme by the entire effect size. No evidence requires a floor-based bracing-endurance phase before loaded trunk work in a healthy strong lifter; the gate is borrowed from LBP rehabilitation (strength §Q10, confidence moderate-high). His decade of squats and deadlifts at ≥ 80% 1RM has already trained his erectors beyond what side bridges do (Hamlyn 2007; Nuzzo 2008) — what is untrained is the anterior and lateral trunk. Ab-wheel and hanging raises produce the highest rectus/oblique activation with low lumbar load (Escamilla 2006). Moderate, controlled loaded flexion is safe in a healthy lifter; the caution derives from porcine in-vitro work and the NSCA position reserves avoidance for existing disc pathology (Schoenfeld & Kolber 2016).

**What Leppänen 2024 does and does not support.** It is the one positive injury-prevention RCT in novice runners (n = 325, LE injury HR 0.66). The reviewer opened the programme: it is a **bodyweight / miniband / towel / partner programme done on a mat** — six slots of hip work (lunges, side lunges, band abduction, bridges, hamstring, hip flexor) and two slots of planks. It cannot be cited *for* a loaded cable core. Its hip content is covered by leg day (§2.4 keeps a unilateral pattern for exactly this reason); its plank content is what he refuses; and unsupervised home versions of similar programmes were null in three trials (§3.6). The plausible reconciliation — supervised, progressive, high-adherence vs unsupervised — cuts against a self-directed core, which is why adherence tracking is built in. **This is not an injury-prevention basis and is not dressed as one.**

**What is lost by skipping the mat, honestly:** the specific passive-stiffness effect of long isometric holds (Lee & McGill 2015 — T4, a surrogate, not an injury outcome), partly replaced by the Pallof holds and carries; and the full Taddei 2020 foot-intrinsic protocol, of which the step and balance work is a partial capture. Nothing with injury-outcome evidence behind it. **If he ever develops low-back symptoms, the recommendation flips to McGill-style isometrics regardless of adherence preference** — that is the population the mat evidence comes from.

### 5.5 Lift E (optional bonus day)

**2 sets per exercise, no set to failure, block weeks 1–2 only, counted in the weekly fractional total the app displays.** v2's 12-set E day added to v3's flat volume would exceed the 12–16 fractional band (REVIEW minor). The hypertrophy coach intended it as a low-fatigue third exposure; the concurrent coach wants it out of loading weeks 3–4.

---

## Part 6 — Where the specialists disagreed, and how it was resolved

| Conflict | Positions | Resolution |
|---|---|---|
| **Does a hip/core strength programme prevent novice-runner injury?** | Strength: yes — Leppänen 2024, HR 0.66. Running: no — Baltich 2017, Toresdahl 2020, Nguyen 2024 all null; Leppänen not mentioned. | Reconciled as supervised-progressive vs unsupervised-home. The v3 core is unsupervised, so Leppänen is **not** cited as its basis (§5.4); the hip half of Leppänen is kept on leg day (§2.4). *Added at the reviewer's request.* |
| **Where does core go?** | Strength: end of Pull + after the easy run. Revision 1: after both runs (non-gym days). | End of Lower and Push — where the cables are and the sessions are shortest. |
| **Weekly template** | Concurrent: rotate (moderate-low). Reviewer: rotation rests on a misread; decide from data. | Rotation withdrawn. v2 calendar kept; Tuesday-run RPE/Talk Test data decide within one block (§4.3). |
| **Block length** | Strength: reactive, 6-wk ceiling. Hypertrophy: 5–6 wk flat. Concurrent: 4-wk aligned to running. | Both in sequence: 4-week aligned blocks during the build; 5-week with reactive trigger after. The "one fewer loading week" cost does not materialise. |
| **Deload load** | Strength ~85% of working; hypertrophy same or −10%. | Main lifts: same reference %, fewer sets, lower effort. Accessories: 90%. Neither has outcome evidence for the number; both agree on reduced-load, not rest. |
| **Volume ramp** | Hypertrophy: flat (Enes JAP, Moreno, JAP 2026). Enes MSSE 2024: ramp > flat from 22 sets. | Flat. The only ramp-positive trained trial started at 22 sets; the two trained trials nearer his volume found no benefit from adding sets. Evidence is quads/curls, not delts. |
| **Frequency** | Grgic/Cuthbert: null volume-equated. Pelland: small positive. | Two exposures, for the per-session-volume reason. |
| **Interference and training status** | Petré: interference in its "trained" tier. Huiberts: no status effect. | Unknown at his level — neither includes anyone near it. Design for fatigue, not molecular interference. |
| **Heavy OHP after the long run** | Strength: heaviest-when-freshest. Concurrent: low-confidence "fine". | With the rotation withdrawn, the pairing stands at the concurrent coach's low-confidence "fine" (upper body insulated; Leveritt 2000). |
| **Leg volume** | Hypertrophy: cut to ~5–6 sets. Running: keep calves. Strength: keep one lunge and one hinge. | Squat + split squat + RDL + calves, ~10 sets. All three honoured. |
| **Pull-up volume placement** | Strength: after squats loses reps. Hypertrophy: order does not change growth. | Pull-ups first. |
| **Lengthened-position selection** | Untrained single-muscle positives. Trained multi-exercise null (Wolf 2025). | Muscle-specific and shrinking with training status. One overhead triceps kept; biceps variants interchangeable. |
| **Race week** | Revision 1: full lifting maintenance. Concurrent Rec 7 / reviewer: legs only. | Legs light or none ≥ 48 h before; upper unchanged. |

---

## Part 7 — Known gaps the reviewer should re-check

- **Nothing was measured in a 10-year lifter.** "Trained" in every literature is 2–5 years. High-confidence claims above are high confidence *about the evidence*, not about its transfer.
- **The back-off fix is untested in this athlete.** 80% for 4–6 is inside the evidence's band and coherent by the formula; whether the reference-anchored double progression outperforms straight sets by RPE is unknown. The unit test guarantees coherence, not optimality.
- **The template question is deferred to data** by design. If the Tuesday RPE data are ambiguous after one block, the default is to keep the v2 calendar.
- **Hypertrophy file has four `[PARTIAL]` markers** — sub-points not fully checked (Brandão 2020; 2024–26 deltoid studies; lateral-raise loading; trained maintenance RCTs — none found). None changes a recommendation.
- **The reactive deload trigger is manual until built.** The fixed block enforces the ceiling meanwhile.
- **Coupling assumes the running down-weeks stay at 8 and 12.** If the ladder changes, the principle holds and the week numbers move; the escape hatch covers interruptions.
- **Time-based easy runs** and **micro-loading** are inferences with no trial evidence either way.
- **Post-10K running maintenance** rests on untrained-population data.

---

## Part 8 — What this means for the app

### Program data (`program.v3.js`)
- `weekTemplate` **unchanged**. `liftCycle` unchanged.
- Main-lift blocks: new scheme `probe_backoff` — probe `{ repMin: 3, repMax: 5, rpe: 8 }`, back-offs `{ sets: 3, repMin: 4, repMax: 6, pctOfReference: 0.80 }`, test-week probe `{ reps: 3, rpe: 9 }`. Volume-day rep ranges 6–8 (pull-up 5–8).
- Accessory blocks: `ramp` removed; `rpeCap: 9`; `lastSetToFailure: true`.
- Lower day: leg-press and leg-curl removed; **split squat / reverse lunge 2×8–12 added**; pull-up volume first; calf raise cue "slow, full range, pause at the bottom".
- Lift E: 2 sets each, `noFailure: true`, `allowedBlockWeeks: [1, 2]`.
- Core moved to the end of Lower (lift:B) and Push (lift:A) as trailing blocks, not a separate `core` slot on run days; the run-day core slot becomes optional. Core phases rebuilt around the three families + gym-based foot work; gates at 0 / 8 / 16 core sessions.
- `weekModifiers`: 4-week build variant and 5-week post-build variant; no `setDelta`; deload `setMultiplier: 0.5`, accessory `loadMultiplier: 0.9`, main lifts keep `pctOfReference` and drop to 2 back-off sets at probe RPE 6.
- Run plan: rungs from week 5 as in §3.2; easy runs `kind: 'time', minutes: 30` throughout; `runMaintenance` per §3.7. `thursdayRestWhen: { blockWeek: 3, longRunKm: 8 }`.
- New exercises: split squat, suitcase carry, cable side bend, cable woodchop, Copenhagen plank, landmine rotation, weighted decline sit-up, single-leg calf raise (step), single-leg balance. Cues updated on calf raise, incline bench (30°), OHP (standing).

### Engine (`src/core/`)
- **`progression.js`**: `SPIKE_LIMIT` 1.10; message "associated with more injuries". New `blockReference(history, lift, blockStart)` — week-1 probe e1RM, raised by a later probe at ≤ RPE 8 or by a completed back-off double progression (+increment). New `backoffLoad(reference, pct)`. Progression reads *back-off* sets against a fixed ceiling. **Unit test: every generated back-off set's implied RPE (from reference, reps, pct) ∈ [6.5, 8.5].**
- **`progression.js` / `stats.js`**: pull-up `effectiveLoad` already uses system mass for e1RM (reviewer confirmed); **audit every `pctOfReference` and `backoffLoad` call path** to confirm system mass is used throughout, with a test.
- **`schedule.js`**: `weekInMeso` phase-aware — derived from the running calendar while `runWeek ≤ runPlan.length` **and a long run has been completed within 14 days**; from lift count otherwise. Deload = run down-week during the build. Entry rule (§4.4) implemented as a one-time `v3StartedAt` marker in meta.
- **`prescribe.js`**: `probe_backoff` handler; `lastSetToFailure` sets the final planned set's `rpeTarget` to 10; lift E gating; Thursday-rest rule; race-week leg rule (`isGoalWeek` → legs `setMultiplier 0.5`, `rpe ≤ 6`, or skipped if < 48 h to the long run).
- **Spike guard** runs on every logged run's GPS distance. **Weekly-total > 30% check** added alongside (Nielsen 2014).
- **Tests**: adjacency invariant (unchanged template — still must pass); block reference; fixed-ceiling progression; calendar coupling **including the 14-day fallback**; **run-cursor mapping from `longCompleted` = 4 and 5** (both must land ≤ 6.0 km); the ladder's ≤ 10% steps and ≤ 20% weekly rises; race-week leg rule; lift-E gating; deload arithmetic (main-lift back-offs at 80%, not 72%).

### Shipped in v3 (pulled forward from the deferred list because v3 rules depend on them)
- **Post-run CR10 RPE (3–4 band shown) + Talk Test yes/no** — decides the template (§4.3) and is the one training variable that tracked novice injury.
- **Bodyweight prompt on pull-up days** — the system-mass rule cannot operate without it (§1.5).
- **Previous lower-limb injury, one question at setup** — the one predictor found in every cohort (§3.4).
- **Core completion tracking** — the adherence check (§5.4).

### Migration
- No exercise moves between days, so `historyAliasDayKey` is not needed. Volume-day range 8–12 → 6–8: the first v3 volume session reads a 10-rep history as above `repMax` and suggests an increase; the fixed RPE ceiling catches an over-suggestion on the next session. **One-block dampener:** cap the first v3 volume-day suggestion at last load + one increment.
- Removed exercises keep their history.
- The block reference has no history at v3 start: the entry-rule probe week establishes it.
- **Entry sequence** per §4.4: deload first if v2 week ≥ 3; then probe week; first lifting deload at run week 8 only if ≥ 2 loading weeks precede it.

### Still deferred to the features phase
Pain 0–10 by site (shin, knee, Achilles/calf, foot) during / after / next morning, with "hold the rung" and "stop" rules · gap ≥ 10 days → re-enter one rung down · reactive deload trigger (manual until built) · bodyweight-drift energy flag · one-time gait and shoe guidance · stall-protocol prompts · fractional-volume display.
