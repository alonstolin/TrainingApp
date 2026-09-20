# Program Review

Reviewer: `program-reviewer`. Read in full: `BRIEF.md`, `strength.md`, `hypertrophy.md`, `running.md`, `concurrent.md`, `SYNTHESIS.md`; also `src/program/program.v1.js` (the v2 content) and `src/core/progression.js` / `schedule.js` where an engine detail bears on a finding. Sources opened directly for the spot-checks: Androulakis-Korakakis 2021 (Frontiers full text), Frandsen 2025 (BJSM published PDF via SDU repository), Huiberts 2024 (Sports Med published PDF via Amsterdam UMC), Refalo 2024 (J Sports Sci published PDF), Enes/Barsuhn JAP 2024 (accepted manuscript), Leppänen 2024 programme PDF (UKK Institute) and abstract numbers, Doma & Deakin 2013 (Europe PMC abstract) and Doma & Deakin 2012 (J-STAGE abstract). The Leppänen BJSM full text and the Doma 2017 review could not be opened; where I rely on a specialist's reading of those I say so.

## Verdict

Not ready to implement as written; ready with specific changes. The direction of every major change is defensible and most of the citations check out, but the single most load-bearing prescription in the program — the heavy-day back-off band for the three strength lifts — is internally inconsistent by the app's own e1RM arithmetic (6 reps at 85% of the reference is past failure; 4 reps at 80% is RPE 6.5), and the biggest structural change (rotating the week) rests on a study whose exposure was same-day strength + running, not a run 24 h after a leg session. Fix the back-off specification, decide the template on the athlete's own Tuesday-run data rather than on Doma, move the cable core to where the cables are, and state how an athlete mid-v2 enters the coupled calendar. Then it is ready.

## Findings

Ordered by severity. Types: unsupported / population mismatch / misread source / contradiction / overclaim / constraint / feasibility / omission.

---

- **[BLOCKER]** — The heavy-day back-off band (3×4–6 @ 80–85% of reference, "RPE 7–8") is arithmetically incoherent and heavier than the evidence it cites
- **What the program says.** §1.1: "The working stimulus is 3×4–6 at 80–85% of a block-reference e1RM, targeting RPE 7–8." §1.3: load rises when "all back-off sets on the heavy day reach the top of their range at ≤ RPE 8.5." Part 8 specifies an engine function `probeBackoffLoads(reference, pct)` taking a percentage band.
- **The problem (misread source + feasibility).** Using the app's own RIR-adjusted Epley (`progression.js`: e1RM = load × (1 + (reps + RIR)/30)) with a reference set from a 5-rep RPE-8 probe, the implied effort of the four corners of the band is: 4 @ 80% → RPE 6.5; 6 @ 80% → RPE 8.5; 4 @ 85% → RPE 8.7; **6 @ 85% → RPE 10.7 (RIR −0.7, i.e. beyond failure)**. The Helms/Zourdos chart agrees: a 6RM is ~83.7% 1RM, so three sets of 6 at 85% cannot be done. Consequences: (i) "RPE 7–8" is achievable only at 4–5 reps @ 80%; (ii) the progression trigger (6 reps at ≤ RPE 8.5 on *all* back-off sets) can never fire at 85% and fires only at the very edge at 80%, so on the most likely engine implementation the athlete misses reps from week 1 and the priority-1 lifts never progress; (iii) set 3 of 3 is always harder than set 1, which the band ignores. The cited evidence is also lighter than the fix: in Androulakis-Korakakis 2021 (verified) the back-offs were **2×3 at 80% of an RPE 9–9.5 single ≈ 76–78% 1RM** — roughly RPE 5–6 triples, 6 back-off reps per session. v3 prescribes 12–18 back-off reps at 80–85%. The strength file's critique that v2's back-offs (~66% 1RM) are too light is correct in direction; the v3 correction overshoots the study it rests on by a wide margin.
- **What the evidence supports.** Back-offs at ~75–82% 1RM, low-to-moderate effort (RPE 6–8), 2–3 sets of 3–5 (Androulakis-Korakakis 2021 T2; Carroll 2019 T2: submaximal relative-intensity sets beat daily maxes; Hickmott 2022: ≤25% velocity loss favours 1RM). Nothing in the files supports sets of 6 at 85%.
- **Suggested resolution.** Couple the percentage to the rep target rather than giving a band: e.g. back-offs **3×4 @ 82%** or **3×5 @ 80%** (both ≈ RPE 7–8 by the app's formula), with the progression trigger "all sets hit the target reps at ≤ RPE 8". Alternatively prescribe back-offs purely by RPE 7–8 for 4–5 reps and log the percentage of reference as a diagnostic. Whatever is chosen, add a unit test that computes the implied RPE of every generated back-off set from the reference and asserts it lies in [6.5, 8.5].

---

- **[MAJOR]** — The template rotation rests on a misread of Doma & Deakin 2013; the exposure it is cited for was never tested
- **What the program says.** §4.3: "The one placement the acute evidence argues directly against is an easy run 24 h after a lower-body session: running economy 5–10% worse and time-to-exhaustion ~30% shorter the next day in trained runners (Doma & Deakin 2013)." On this the lead adopts the rotation (Sun Lower · Mon Push · Tue run · Wed Pull · Fri S&A · Sat long).
- **The problem (misread source → unsupported decision).** The verified abstract: fourteen runners did **both** a strength session and a running session on the preceding day, 6 h apart, in either order (SR or RS); the next-day tests were compared with a rested baseline. There was no "strength session only, run the next day" condition. Cost of running was worse only after SR (0.72→0.76, 0.70→0.77); after RS — where the strength session was the *later* session and therefore closer to the next-day test — it was not different from baseline (0.73, 0.72). TTE fell in both (335→238 s and →275 s). The authors' own conclusion in the 2012 companion (also verified): "Combined strength and endurance training on the same day appears to cause an accumulation effect of fatigue which impairs running performance the following day." That is evidence about same-day combined training — which v2 already avoids — not about Monday legs → Tuesday run. The concurrent file describes the 2012 study correctly ("same-day strength + endurance") and the 2013 study incorrectly ("the day after a lower-body strength session"); the synthesis inherits the error and presents it as the direct evidence. The specialist's confidence in the rotation was already "moderate-low"; with the citation removed it is inference plus the Doma 2017 narrative review (abstract only). The muscle-damage mechanism the argument leans on (eccentric leg work → worse running economy) peaks at 24–72 h, so "48 h after legs" is not obviously better than 24 h on that mechanism either; and the repeated-bout effect in a 10-year lifter shrinks all of it, as the concurrent file concedes.
- **Costs the synthesis does not weigh.** The rotation puts the maintenance leg session 24 h after a long run that reaches 8–10 km (untested, admitted), puts the priority-1 heavy incline 24 h after squats/RDL instead of 24 h after an easy run, and makes the morning-after-long-run pain check (running §8, the injury-critical observation) coincide with squat DOMS. On the 10K weekend the cursor engine will owe a Lower session the day after the race; §4.4's "no leg session inside 48 h of the 10K" has no mechanism.
- **What the evidence supports.** Every run on a non-lifting day (Petré, Schumann, Robineau, Ratamess — all consistent). Beyond that, nothing in the files distinguishes a run 24 h vs 48 h after a leg session. The athlete has been running Tuesdays after Monday legs for weeks; his own logged Tuesday runs are the only evidence that exists.
- **Suggested resolution.** Do not rotate on this evidence. Keep the v2 calendar mapping; pull "post-run CR10 RPE + Talk Test" forward from the deferred features list so the Tuesday-vs-Thursday question can be answered from data within one block. If Tuesday easy runs are consistently RPE ≥ 5 or Talk-Test-negative while Thursday optional runs are not, adopt the conservative alternative (easy run → Thursday, Tuesday becomes the non-running optional slot), which the specialist rated higher than the rotation. If the lead still prefers the rotation, downgrade its stated basis to "lead preference on goal ranking; no direct evidence" and add the cursor rule for race weekend.

---

- **[MAJOR]** — A cable/machine core programme is scheduled on the two days the athlete is not at the gym
- **What the program says.** §5.4: core "two sessions per week (after the easy run Tuesday, after the long run Saturday)"; content is cable crunch, Pallof press, cable woodchop, suitcase carry, cable side bend, Copenhagen plank on a bench, hanging raises, landmine rotation. Plus "~5 min of foot-intrinsic work in the same slot" (short-foot holds, single-leg balance).
- **The problem (feasibility / constraint / omission).** The brief calls adherence "the binding constraint" for core and says the mat phase failed because he skipped it. Every v3 core exercise needs the gym; both core slots are outdoor GPS-run days. Unless he runs to the gym, the design asks for two extra gym trips per week for 10–15 minutes of accessory work — the same adherence shape that killed v2's core, wearing different clothes. The strength coach's own recommendation was "at the end of the Pull day and after the easy run"; the synthesis moved both slots onto run days without saying why. The foot-intrinsic work is also mat-type floor work — exactly the category the athlete rejects — placed in a 5-minute afterthought.
- **What the brief allows.** "Core work rides along on non-lifting days or at the end of sessions." Session budget: by my count v3 lifting sessions are Lower 14 sets, Push 15, Pull 18, S&A 18 — roughly 50, 55, 65, 65 minutes with the programmed rests. Adding 10–15 min of core to Pull and S&A pushes them to 75–80 min; adding it to Lower (~50 min) and Push (~55 min) keeps every session ≤ 70.
- **Suggested resolution.** Put the two core sessions at the end of the two shortest lifting days (Lower and Push in either template), where the cables are, and keep the run-day slot optional. Say explicitly which foot exercises can be done standing at a cable stack or on a step, or drop the foot work to a one-line cue and accept the (single-trial) Taddei evidence is not being captured. Track core completion as v2 did; if the first block shows < 75% adherence, the placement is wrong again.

---

- **[MAJOR]** — Leppänen 2024 is cited as the basis for a loaded core programme it does not support, and the running and strength files contradict each other on whether strength programmes prevent running injury; the synthesis carries both without resolving them
- **What the program says.** §5.4 leads its basis with "The strongest injury-prevention evidence in *novice runners* — Leppänen 2024 BJSM, n = 325, LE injury HR 0.66 — used a programme that is 6/8 loaded hip/leg strength and 2/8 trunk holds, with resistance 'instructed to feel heavy'; the authors attribute the effect to progressive resistance and supervision." §3.6 says "Generic hip/quad/core home programs did nothing in two RCTs and a pilot."
- **The problem (contradiction + overclaim).** I opened the Run RCT programme PDF. The 8 slots are: front plank family (bear-crawl leg extensions, T-rotation, static plank 20–40 s, plank with leg lifts), side plank family (side plank, static side plank, Copenhagen adductor), pelvic lift (glute bridge variants, 20–40 s holds), miniband hip abduction (squat, sideways/forward walks), hip flexor (straight-leg raise, miniband hip flexion), lunges (split squat, in-place, walking, jumping), hamstring (band deadlift 2–3×12–15, towel curls, partner Nordic), side lunges. It is a bodyweight / miniband / towel / partner programme done on a mat — not "loaded hip/leg strength" in any sense the athlete's leg day resembles, and its two trunk slots are precisely the planks he will not do. So Leppänen cannot be cited *for* a cable/machine loaded core; at most it is neutral. The strength file is honest about this in its own text ("the trial cannot tell us whether the plank slots contributed... nothing with injury-outcome evidence behind it") and the synthesis repeats the honest sentence — but leads the basis paragraph with the trial as if it supported the decision. Separately, the running coach lists three null RCTs of hip/quad/core strengthening (Baltich 2017, Toresdahl 2020, Nguyen 2024) and never mentions Leppänen; the strength coach cites Leppänen as positive and mentions Toresdahl only through Leppänen's authors. Part 6 does not list this. The plausible reconciliation — supervised, progressive, high-adherence (89%, per the strength file; I could not verify) vs unsupervised home programmes — cuts against the synthesis: v3's core is unsupervised and self-directed, i.e. the arm of the literature that produced nulls. The phrase "instructed to feel heavy" does not appear on the programme PDF; I could not verify it in the paper.
- **What the evidence supports.** The decision to skip a mat gate is supported by the *absence* of evidence for the gate in healthy strong lifters (Hamlyn 2007; Nuzzo 2008; Lee & McGill 2015 is a stiffness surrogate) and by the adherence argument. That is a sound basis. It is not an injury-prevention basis and should not be dressed as one.
- **Suggested resolution.** Rewrite the §5.4 basis to lead with adherence and the absence of a gate, cite Leppänen only as "the one positive novice-runner trial used supervised, progressive hip work plus planks; the hip content is covered by leg day, the plank content is what he refuses, and unsupervised versions of similar programmes were null" — and add the row to Part 6. Consider keeping one unilateral hip exercise on leg day (see the MINOR below) since that is the half of Leppänen the athlete can actually keep.

---

- **[MAJOR]** — "Holding volume ... produced *more* strength (Enes JAP 2024)" is a misread; the study found a group main effect with no group×time interaction
- **What the program says.** §2.1: "In the closest population match — trained ≥ 3 y, squat ≥ 1.5× BW, habitual ~14 sets — holding volume matched or beat adding 30–60% for hypertrophy and produced *more* strength (Enes JAP 2024)." Part 6 says the ramp "had no support in trained lifters".
- **The problem (misread source + overclaim).** Verified from the accepted manuscript: 1RM showed "a main time effect (21.47 kg) ... Our analysis also revealed a main group effect (p<0.0268) in which the CON group had higher 1RM values compared to G30 and G60" — pooled across pre and post, with no interaction reported. The authors write "CON demonstrated greater *aggregate* maximum strength," which is what the hypertrophy file (correctly) paraphrased as "greater overall 1RM"; the synthesis converted it to a larger *gain*. The study also had 45% dropout (55 randomised, 29 completers, n = 9–10 per group), no a priori power, and an ITT model. And it is a quadriceps study; the flat-volume decision is being applied to delts and arms. Finally, "no support in trained lifters" for a ramp ignores Enes MSSE 2024 (trained males, ramp > flat for strength, "possible small" hypertrophy benefit) — dismissed in one clause as a "different world" because it started at 22 sets. That is a fair contextual discount, not "no support".
- **What the evidence supports.** The hypertrophy conclusion survives on the null (ΣMT 1.07 / 0.76 / 0.70 cm, no group difference; Moreno 2024; JAP 2026) plus Pelland's diminishing returns. The strength claim should be dropped.
- **Suggested resolution.** Strike "produced more strength". Change Part 6's "no support" to "the only ramp-positive trained-lifter trial started at 22 sets; the two trained trials nearer his volume found no benefit from adding sets." State that the flat-volume evidence is legs and curls, not delts. Note that Enes JAP's *effort* protocol (2 RIR, last set of each exercise to failure, 2-min rests) is exactly v3's §2.2 — an unmentioned precedent in the synthesis's favour.

---

- **[MAJOR]** — The v2 → v3 transition is under-specified where it matters: how an athlete mid-v2 enters the run-coupled lifting calendar, and what happens to the lifting block when running stops
- **What the program says.** §4.4 / Part 8: during the build, `weekInMeso` is "derived from the running calendar"; deloads on run weeks 8 and 12; run week 15 is a maintenance week. Migration section covers the volume-day rep range, removed exercises, and the empty block reference, and nothing else.
- **The problem (omission / feasibility).** (i) Entry. The brief says he is "around week 5–6" of the ladder; the run cursor is `longCompleted + 1`. If he enters at run week 6 he lands in lifting week 2 of the first 4-week block: the block reference is set by his first-ever probe, the RPE-9 *test* week follows seven days later, then a deload. If he is currently in v2 week 3 or 4 (RPE 8.5–9, +1/+2 accessory sets), there is no deload between v2's peak and v3's first loading week either. The synthesis says nothing about where he is in v2 or how the handoff is sequenced. (ii) Coupling failure mode. Because the lifting week is derived from the run week and the run week advances only on a *completed* long run, any running interruption — illness, a shin, travel, the 10-day gap rule the running coach wants — freezes the lifting mesocycle in place: the deload never arrives, or the test week repeats. For a fatigue-sensitive lifter this is the wrong direction of coupling to fail in. (iii) The run-cursor re-map is benign by my reading (`longCompleted + 1` puts him on v3 week 5 = 5.5 km or week 6 = 6.0 km, both ≤ his longest run) but the synthesis should say so and Part 8 should test it, because the "5.5 not 6" fix is the running change with the highest confidence and a wrong mapping would put him on 6.5 km, a 24–30% spike.
- **Suggested resolution.** Add an entry rule: v3 begins with a probe week regardless of run week, and if the athlete is in v2 week 3 or 4 it begins with a deload week first; the first 4-week block is then aligned by *shortening or lengthening the first running down-week gap*, not by truncating the lifting block. Add a decoupling rule: if no long run has been completed for ≥ 14 days, `weekInMeso` falls back to the lift-count clock. Add a test for the run-cursor mapping from both plausible starting states.

---

- **[MINOR]** — Race-week full-body lifting maintenance costs priority 1 for priority 3 without evidence that it helps
- **What the program says.** §4.4: run week 15 (the 10K) is a "lifting maintenance week: top sets RPE 6–7, sets halved".
- **The problem (unsupported / constraint: priority order).** The concurrent file's own evidence says upper-body lifting does not impair running (Sporer & Wenger; Robineau; Huiberts). The taper evidence (Bosquet 2007) is for competitive endurance athletes tapering endurance volume before a race; the athlete is completing a 10 km at conversational pace, not racing. Halving upper-body sets in the race week gives the priority-1 lifts a second reduced week three weeks after the week-12 deload, for a benefit nobody has shown. The concurrent file itself recommends (Rec 7) putting *only legs* on maintenance in weeks 13–14.
- **Suggested resolution.** Race week: legs light or none ≥ 48 h before the run; upper-body sessions unchanged.

---

- **[MINOR]** — Schoenfeld 2017 does not distinguish 8–12 from 6–8; the volume-day change rests on specificity, not on the cited meta-analysis
- **What the program says.** §1.2: "Loads > 60% 1RM beat lighter loads for 1RM even when hypertrophy is equal — Schoenfeld 2017, T1." Confidence "moderate".
- **The problem (overclaim).** The meta contrasted ≤60% vs >60% 1RM to failure. v2's 3×8–12 at RPE ≤ 8 is ~70–76% 1RM — already above the cut. The change to 6–8 is a specificity inference (T5). The strength file says as much ("no direct trial in this population"); the synthesis keeps the T1 label on a contrast the T1 source did not test.
- **Suggested resolution.** Label the basis "specificity principle; no trial distinguishes 6–8 from 8–12 for 1RM in trained lifters" and confidence "low–moderate". The decision can stand.

---

- **[MINOR]** — Frandsen 2025 is described as "a threshold, not a slope" against the authors' own description, and the authors' warning about chained ≤10% steps is not carried into the ladder
- **What the program says.** §3.1: "HRR 1.64 for 10–30% over, 1.52 for 30–100%, 2.28 for > 100% — a threshold, not a slope." §3.2: "Every step ≤ 9% against the 30-day longest."
- **The problem (overclaim / omission).** The paper's Discussion and Conclusion call it "a significant dose-response relationship" and Figure 3a is a rising curve; the 1–10% progression band had HRR 1.19 (−10% to 57%, p = 0.22) vs regression, and the authors write "progressions up to 10% are not necessarily safe either." They add: "running 11 km, 12.1 km and 13.3 km in subsequent sessions within the same week, despite each reflecting a 10% increase, may still be considered excessive due to insufficient recovery time." v3 chains 6–9% steps every week for three weeks before each down-week, which is defensible, but the ladder text presents ≤ 10% as compliance with a safe rule rather than as the edge of one. Also worth one line in the app copy: 1117 of the 1311 overuse injuries (85%) occurred in the reference state — the guard catches the spike-related minority of injuries; it is not the main safeguard.
- **Suggested resolution.** Say "dose-response; ≤ 10% is where the increase stops being detectable, not where risk is zero." Keep the ladder. Keep the reworded warning.

---

- **[MINOR]** — Huiberts 2024 did not find that interference "falls with training status"; the between-status test was null
- **What the program says.** §4.1 / Part 6: "Petré and Huiberts point opposite ways" (Petré: rises with status; Huiberts: falls).
- **The problem (misread source).** Verified: "For maximal lower-body and upper-body strength and power, no differences in adaptations to concurrent training were observed between untrained and trained participants" (P = 1.00 lower-body, P = 0.45 upper-body). The concurrent file read within-subgroup significance (untrained p = 0.02, trained p = 0.14) as a trend the authors explicitly tested and rejected. The resolution ("unknown at his level") is unaffected — Huiberts had zero highly-trained strength studies, which is the point that matters.
- **Suggested resolution.** Rewrite as "Petré finds interference only in its 'trained' tier (team-sport athletes); Huiberts finds no status effect; neither includes anyone at his level."

---

- **[MINOR]** — "Never a full week off" and "deload weeks are not free" over-extend Coleman 2024
- **What the program says.** §1.4, §5.2: "Never a full week off (Coleman 2024)"; §4.4: "Deload weeks are not free (Coleman 2024...)" used to justify aligning reduced-load deloads with running down-weeks.
- **The problem (overclaim).** One trial, n = 39 students (mean ~3–4 y training, 20 sets/muscle/week), a complete rest week at the midpoint of a 9-week block, "between-group intervals usually containing zero" (hypertrophy file). That supports "prefer reduced-load over rest" at moderate confidence; it does not support "never", and it says nothing about the cost of a *reduced-load* week — which no trial has tested (both lifting specialists say so). Using it to price reduced-load deloads in §4.4 stretches it further.
- **Suggested resolution.** "Prefer a reduced-load week to a rest week (one trained-lifter trial, small effect)." Drop the second use.

---

- **[MINOR]** — The strength coach's request to keep one unilateral / hip exercise on leg day was dropped silently
- **What the program says.** §2.4: squat 3×5–8, RDL 3×8–10, calves 2×10–15; leg press and leg curl removed.
- **The problem (omission).** Strength §Rec D(iii): "if the leg day is ever cut for running fatigue, keep one split-squat/lunge and one hip-hinge, because those — not planks — carried most of the injury-prevention programme's content." Six of Leppänen's eight slots are lunges, side lunges, band abduction, glute bridges, hamstring and hip flexor work. v3's leg day is two bilateral barbell lifts and calves during "the riskiest 8–10 weeks of his running life" (running §Summary).
- **Suggested resolution.** Replace the removed leg press with one unilateral pattern (split squat or reverse lunge, 2×8–12) at no net set cost; optionally a cable or machine hip abduction 2×12–15 in the core slot, since that is gym-based.

---

- **[MINOR]** — The optional bonus lift day (E) is not specified for v3 and, unchanged, would overshoot the flat-volume target
- **What the program says.** §4.3 keeps "Optional: bonus delt/arm day"; Part 8 never mentions `lift:E`.
- **The problem (omission / contradiction).** v2's E day is 12 direct sets (3 each of laterals, reverse pec deck, curls, pushdowns). Added to v3's 8–10 direct sets/muscle/week it yields 11–13 direct ≈ 15–19 fractional — above the 12–16 band §2.1 sets, and above the per-session rule if it lands next to the S&A day. The hypertrophy coach intended the third exposure as "low-fatigue"; the concurrent coach wants it kept out of loading weeks 3–4.
- **Suggested resolution.** Specify E as 2 sets per exercise, no set to failure, permitted only in block week 1–2, and count it in the weekly fractional total the app displays.

---

- **[MINOR]** — Deload content is inconsistent between §5.1 and §5.2
- **What the program says.** §5.1 table: deload main lifts "1×3 @ RPE 6, 2×4 @ 80% [of reference]". §5.2: "Half the sets, ~90% of working load, RPE ≤ 6–7." Part 8: `loadMultiplier: 0.9`.
- **The problem (contradiction).** 80% of reference for 4 reps is RPE ~6.5 by the app's formula; 90% of a working load that is itself 80–85% of reference is 72–76% of reference — a different and lighter set. The engine will implement one; the document specifies two.
- **Suggested resolution.** Pick one (90% of working load is the simpler engine rule and matches the hypertrophy coach) and make the table match.

---

- **[MINOR]** — Two v3 rules depend on features the same document defers
- **What the program says.** §1.5 requires logging bodyweight on pull-up days and recomputing when it moves ± 1.5 kg; §5.3 requires a reactive deload trigger; running §8's "previous lower-limb injury" is "the one predictor found in every cohort". Part 8 defers the bodyweight prompt, the reactive trigger, the injury question, and run RPE / Talk Test to "the features phase".
- **The problem (omission).** At launch the system-mass rule cannot operate as written, the post-10K deload rule cannot fire, and the ladder starts without the one risk factor that would make every hold rule stricter. The rotation decision (above) also needs the run-RPE data that is deferred.
- **Suggested resolution.** Pull forward the bodyweight prompt (one field) and the previous-injury question (one field at setup) into v3; state that the reactive trigger is manual until built.

---

- **[MINOR]** — There is no rest day in any week where the optional Thursday slot is used, and the synthesis does not say when it must stay empty
- **What the program says.** Rotated template: Sat long · Sun Lower · Mon Push · Tue run · Wed Pull · Thu optional · Fri S&A. (v2 has the same property.)
- **The problem (feasibility).** With the optional run or bonus day used, seven consecutive training days. The running coach cites Warden 2021 "≥ 1 rest day/week" for bone and wants the third run to be "the first thing dropped"; §3.5 restricts the optional run to lifting weeks 1–2 and deloads but says nothing about the bonus lift day.
- **Suggested resolution.** Make Thursday a rest day by default in block week 3 (test week) and in any week the long run is ≥ 8 km; the app should show the optional slot as "rest" unless the athlete opts in.

## Contradictions between specialists

| Conflict | Position A | Position B | Synthesis |
|---|---|---|---|
| Does a hip/core strength programme prevent novice-runner injury? | Strength: yes — Leppänen 2024, HR 0.66, "the strongest injury-prevention evidence in novice runners" | Running: no — Baltich 2017, Toresdahl 2020, Nguyen 2024 all null; Leppänen not mentioned | **Not listed in Part 6; both statements appear (§3.6, §5.4) unreconciled.** Reconciliation (supervised/progressive vs home/unsupervised) undermines the use §5.4 makes of it. |
| Where does core go? | Strength: end of Pull day + after the easy run | Synthesis: after both runs | Changed without stated reason; creates the gym-on-non-gym-days problem. |
| Block length / deload timing | Strength: reactive, 6-wk ceiling; Hypertrophy: 5–6 wk flat; Concurrent: 4-wk aligned to running | — | Resolved "both in sequence". Reasonable. The claimed cost ("one fewer loading week") does not materialise — with the race-week reduction, 4-week and 5-week blocks both give 8 loading weeks over run weeks 5–15. |
| Deload load | Strength ~85% of working load; Hypertrophy same or −10% | — | 90% by fiat; acknowledged as evidence-free. Fine — but §5.1 contradicts it (above). |
| Volume ramp | Hypertrophy: flat (Enes JAP, Moreno, JAP 2026) | Enes MSSE 2024: ramp > flat in trained males (from 22 sets) | Resolved flat. Correct direction; "no support" overstates it and the strength-gain claim is a misread. |
| Interference vs training status | Petré: rises | Huiberts: (mis-described as) falls | Resolved "unknown at his level". Correct conclusion; Huiberts actually found no status effect. |
| Heavy OHP after long run | Strength: heaviest-when-freshest | Concurrent: downgraded to low concern | "Moot because of the rotation." If the rotation is dropped (recommended), the concurrent coach's low-confidence "fine" stands and should be stated as such. |
| Leg volume | Hypertrophy: cut to ~5–6 sets | Running: keep calves; Strength: keep one lunge/split-squat and one hinge | Squat + RDL + calves (8 sets). Calves honoured; the unilateral request dropped. |
| Pull-up volume placement | Strength: after squats loses reps | Hypertrophy: order does not change growth | Pull-ups first. Both satisfied. |
| Frequency | Grgic/Cuthbert: null when volume-equated | Pelland: small positive | Two exposures for the per-session-volume reason. Fine. |
| Lengthened-position selection | Untrained single-muscle positives | Trained multi-exercise null (Wolf 2025) | One overhead triceps movement; biceps variants interchangeable. Fine. |
| Rate of progress vs increments | Strength: 1.25 kg on OHP/pull-up (arithmetic from Latella) | Hypertrophy: progress accessories by double progression | No conflict; noted because both are labelled "moderate" on inference. |

## Confidence audit

Decisions stated with more confidence than their sources carry:

1. **§3.1 spike guard 1.10 — "Confidence: high on both."** Running coach: high on what the paper says, *moderate* on transfer to a novice (cohort median 9.5 y, BMI 24, no subgroup analysis possible). The rung fix (5.5 km) is high; the threshold transfer is moderate.
2. **§3.3 all-easy intensity — "high".** Running coach rated the Kluitenberg 2016 intensity signal *moderate* (authors flag confounding; higher volume was paradoxically protective). The instruments (Talk Test / CR10 vs VT1) are high; the injury argument for all-easy is moderate.
3. **§1.1 back-offs — "high that back-offs are too light".** High that v2's are too light (66% 1RM); but the v3 replacement is heavier than the cited protocol (~77%, triples) and incoherent at the 85%/6-rep corner. Confidence in the *replacement* should be low until the band is fixed.
4. **§1.2 volume day 6–8 — "moderate".** Effectively T5 specificity; the T1 citation does not test the contrast. Low–moderate.
5. **§2.1 "why flat, not ramped" — "moderate".** Hypertrophy null holds; the strength half is a misread; the evidence is quads and curls, not delts/arms. Moderate for the null, low for any delt/arm-specific claim.
6. **§2.2 effort — "moderate-high".** Refalo 2024 is a well-matched population (males 7.8 ± 2.6 y trained) but quadriceps only, within-subject, and in a deliberate energy surplus (+3.1 kg over 10 weeks). Applying it to isolation delt/arm work in an athlete who may run himself into a small deficit (§4.5) is an extrapolation the source's own Key Points flag ("may also depend on ... exercise selection ... and musculature targeted"). Moderate.
7. **§4.3 rotation — adopted; specialist "moderate-low".** With Doma 2013 removed, low.
8. **§4.4 "deload weeks are not free (Coleman)".** Coleman tested rest, not reduced load. Low as applied.
9. **§5.4 core — Leppänen framed as support.** The decision's real basis (absence of a gate + adherence) is moderate-high; the injury-prevention framing is unsupported.
10. **Part 6 "Petré and Huiberts point opposite ways".** Huiberts's between-status test was null; the "conflict" is half-manufactured.
11. **§1.4 / §5.2 "never a full week off".** One small trial with CIs crossing zero. Moderate for "prefer reduced-load"; the word "never" is not earned.
12. **§1.6 incline 30° "lowest anterior-deltoid overlap with OHP an incline allows".** Rodríguez-Ridao: anterior deltoid rises with angle; 15° has less overlap than 30°. The strength file's version was conditional ("while still maximizing upper-pec involvement"); the synthesis dropped the condition. Trivial, T4 EMG either way.

## What was done well

Keep these through revision:

- **The spike guard fix (1.15 → 1.10) and the 5.5 km rung.** Frandsen's numbers verify exactly; the v2 week-5 rung really is the only rung that breaks the rule and it is the one he is on. The arithmetic of the whole v3 ladder (every step ≤ 9.4% of the 30-day longest; no weekly rise > 20%) checks out. This is the highest-value, highest-confidence change in the document.
- **Every run on a non-lifting day, and the four fixed calendar days (Sun/Mon/Wed/Fri) preserved** under either template. Constraints honoured.
- **Pull-up loads on system mass.** Correct, verified by the strength coach against Muñoz-López 2017, and already how the engine computes e1RM.
- **Fractional volume counting and flat accessory volume with RPE 8–9 + last set to 10.** The Pelland model comparison is read correctly; Refalo 2024 verifies; and — unmentioned — Enes JAP 2024's own training protocol was exactly this effort scheme.
- **Session length.** v3 as specified (Lower 14 · Push 15 · Pull 18 · S&A 18 sets, no ramp) fits 60–70 minutes; v2's week-4 sessions were 24–28 sets and ran 75–90 minutes with core attached. The flat design fixes a real feasibility problem in v2.
- **Legs to a smaller dose with calves kept** for the tibia, and the "legs are the flexible session" rule.
- **Operationalising "easy"** with the Talk Test and CR10 3–4, and the no-speed-work rule through the build.
- **The core reasoning "an adherent loaded programme beats a skipped mat programme by the entire effect size."** That sentence is the correct basis for §5.4; the fix is to lead with it.
- **Honest gap-reporting in Part 7**, the population caveats on Frandsen and Huiberts, the energy-availability flag, and the explicit marking of "lead inference"/"lead resolution".
- **Correctly retiring two v2 citations** (Yang 2018; Wilson 2012's modality claim) and the RP landmark rationale.
- **Post-10K maintenance** re-based on intensity rather than a permanent 10 km long run.
