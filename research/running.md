# Running (5 km → 10K, novice, heavy lifter) — Research Findings

Scope: the second half of a novice's journey — from ~5 km continuous
(~35 min at ~9 km/h, 6:40/km) to a continuous 10 km — for a heavy, muscular
adult who lifts four days a week. Lifting and the scheduling of runs around
lifting belong to other specialists; they are mentioned only where they bind
the running decision.

Conventions. Every evidence line gives source · design · population · n ·
effect · confidence. "Novice" = <1 year or <10 km/year of running; "recreational"
= regular runners without competitive background; "trained" = competitive or
sub-40-min 10K. Time-based rungs are converted at the athlete's own 9 km/h
(25 min ≈ 3.75 km, 30 min ≈ 4.5 km, 35 min ≈ 5.25 km). All sources listed at
the end were opened (abstract or full text) unless marked otherwise.

## Summary

- **The single-session spike rule is the best-supported load guard available,
  and the app implements it with the wrong threshold.** Frandsen et al. 2025
  (BJSM; 5,205 runners, 588,071 sessions) found that a run more than 10% longer
  than the longest run in the previous 30 days raised the overuse-injury hazard
  (HRR 1.64 for 10–30% over; 1.52 for 30–100%; 2.28 for >100%). Weekly ratios
  (ACWR, week-to-week) were null or *inverse*. `SPIKE_LIMIT` in
  `src/core/progression.js` is **1.15**; the paper's reference band ends at
  **1.10**, and there is no gradient between 10–30% and 30–100% — it reads as a
  threshold, not a slope. Caveat: cohort was experienced (median 9.5 years,
  BMI 24), not novices.
- **The rung he is on now is the only rung that breaks the rule.** Week 5's
  6 km long run is 114% of the 35-min run (5.25 km) and 120% of a literal 5 km.
  Every later rung (6→6.5→7→7.5→8→8.5→9.3→10) is a 6–9% step. Insert 5.5 km.
- **The 10% *weekly* rule is folklore in the precise sense that the only RCT of
  it (Buist 2008, n = 532 novices) found no injury reduction versus a faster
  8-week program**, and a 2018 systematic review found "very limited evidence"
  that changes in load predict injury at all. But in the one novice cohort
  with GPS data, >30% weekly jumps tracked distance-type injuries (HR 1.59,
  95% CI 0.96–2.66). The ladder's post-down-week rebounds are +28% and +43% in
  weekly volume. Honour both rules; they cost nothing.
- **Body mass is a replicated risk factor in novice runners** (Buist 2010: men
  HR 1.15 per BMI unit; Kluitenberg 2015, n = 1,696; Nielsen 2013, n = 930,
  borderline) **and not in experienced recreational runners** (Malisoux 2020,
  n = 848, SHR 1.00). The mechanism is bone fatigue: microdamage accumulation
  scales with strain to the 17th power and **a 10% rise in tissue strain halves
  the number of loading cycles to failure** (Warden 2021). Nobody has studied
  heavy *lean* novices; the mechanics do not care what the mass is made of.
  He should sit at the conservative end of every rule until his skeleton has
  had ~3 months of consistent running, and he should not add speed — speed
  raises bone strain more than distance does.
- **All-easy intensity is right for this block.** The only novice cohort that
  measured intensity found higher weekly RPE → more injury (Kluitenberg 2016,
  n = 1,696). Polarised/threshold trials are in 38–39-min 10K runners and do
  not transfer. Strides have no novice evidence; skip them until after the
  10K. "Conversational" is operationalisable without a HR monitor: the Talk
  Test and RPE are validated against the first ventilatory threshold.
- **The next 8–10 weeks are the riskiest of his running life.** Novice injury
  incidence is 17.8/1000 h vs 7.7 for recreational runners (Videbæk 2015
  meta-analysis); bone stress injuries surface 3–4 weeks after a load error
  (Warden 2021), with recruit data peaking in weeks 3–8 of a new load.
- **Footwear and gait have injury-outcome RCTs; the program mentions
  neither.** Hard midsoles raised injury 1.5× (Malisoux 2020; effect not
  significant in >78 kg men). Two weeks of "land softer" gait retraining cut
  12-month injury from 38% to 16% in 320 novices (Chan 2018, HR 0.38). Foot-
  intrinsic strengthening cut injury ~2.4× in recreational runners (Taddei
  2020). Generic hip/quad/core strength programs did nothing in two RCTs and a
  2024 pilot.
- **Two runs a week is enough to reach 10K in 9–11 weeks from here**; the
  aerobic side is not limiting. Frequency-vs-injury evidence in beginners is
  one non-significant trend (3×/wk worse than 2×/wk). The third run should
  stay optional and short.
- **After the 10K, intensity — not distance — is what holds fitness** (Hickson
  1981; Spiering 2021): two runs a week maintain endurance ≥15 weeks if
  intensity is kept. The program's "5 km easy / 10 km long" maintenance keeps
  the biggest weekly load in place forever for no maintenance benefit.

## Where the current program is wrong, unsupported, or suboptimal

1. **"A guard warns if any single run would exceed ~110% of the longest run in
   the previous 30 days."** The code warns above **115%**
   (`SPIKE_LIMIT = 1.15`; the comment says "the plan itself never exceeds
   ~1.10"). Frandsen 2025's safe band is ≤10% above the 30-day longest; the
   10–30% band carried HRR 1.64 (95% CI 1.31–2.05). **Set the threshold to
   1.10.** Confidence: high on what the paper says; moderate on transfer.

2. **Week 5: "3 km easy / 6 km long" after a 30-min down week.** With his
   longest run at 5–5.25 km, 6 km is a 14–20% spike — the only rung of the
   ladder that violates its own guard, and it is the rung he is on. The
   arithmetic is unforgiving because the time→distance switch was converted at
   an assumed pace faster than his real 9 km/h. **Insert a 5.5 km rung** (or
   make week 5 = 5.5 km and shift the rest by one week). Confidence: high.

3. **Down-week rebounds.** Weekly totals go 9 km (wk 8, down) → 11.5 km
   (+28%) and 10 km (wk 12, down) → 14.3 km (+43%). Both satisfy the 30-day
   rule; the second exceeds the >30% weekly progression associated with
   distance-type injuries (PFP, ITBS, MTSS, patellar tendinopathy) in 874
   novices (Nielsen 2014, HR 1.59, 0.96–2.66). **Make down weeks shallower —
   long run ≈ 80% of the preceding week, not 60–70% — so no week rises more
   than ~25% over the previous.** Confidence: moderate (the novice effect was
   imprecise; the cost of the fix is nil).

4. **"All at conversational / Zone 2 intensity" — with no operational
   definition.** Correct prescription, nothing to check it against. Add the
   Talk Test ("could you say a full sentence without gasping, at every point of
   the run?") and CR10 RPE after every run; RPE ≥ 5 on an easy run is an
   intensity error. Confidence: high that these track VT1 (Bok 2022).

5. **Guard message: "Big single-run jumps are the main driver of running
   injuries."** Overclaims an observational association in experienced runners
   whose authors call the 30-day window arbitrary and ask for RCTs. Say
   "associated with more injuries".

6. **Two runs a week makes the long run ~65% of weekly volume every week**
   (6/9 … 10/15). The conventional ≤30% share is expert opinion only, and
   Frandsen 2025 says the per-session spike, not the weekly total, is what
   tracks injury — so this is not a proven fault. What it does mean is that
   the chronic base under each long run is 9–15 km/week, which puts him in the
   "<15 km/week and slower than 6:00/km" group that tended to more injuries in
   ProjectRun21 (Damsted 2019, half-marathoners, NS). **Not a reason to add a
   third progression; a reason to keep every increment ≤10% and to let the
   optional third run be a short easy one if he is symptom-free.**
   Confidence: low.

7. **Time-based weeks 1–4, distance from week 5.** No evidence exists for or
   against either mode or for the switch-over point (blogs only). The one
   thing the evidence *does* say is that the guard is a distance rule, and the
   app already logs GPS distance on time-based runs — so the guard should run
   on every logged run regardless of prescription mode, and the first distance
   rung must be derived from the actual km of the last time-based long run.

8. **Footwear, gait and foot strength are absent.** Three RCTs with injury
   outcomes exist (Malisoux 2020; Chan 2018 in novices; Taddei 2020). Cheap
   additions: cushioned standard-drop trainer; one gait cue; 5 min of foot-
   intrinsic work in the core slot.

9. **"After the 10K, maintenance at 5 km easy / 10 km long."** More distance
   than maintenance needs and the biggest single-session load kept
   permanently. The maintenance literature's lever is intensity: 7–8 km easy
   plus 4–5 km with some faster running holds it at less leg cost (Hickson
   1981; Spiering 2021). Confidence: moderate.

10. **The cited "BJSM 2025 Aarhus cohort" is used correctly in shape, but its
    population is not stated anywhere.** Median 9.5 years' experience, BMI
    24, and the authors could not test effect modification by BMI, age or
    experience for lack of injuries in subgroups. The novice-specific Aarhus
    work (Nielsen 2013, 2014) points the same direction and should be the
    cited basis for a beginner.

## Findings

### 1. The path from 5 km to 10K

**Finding.** No RCT or cohort tests a specific 5K→10K progression. The evidence
base for novice programs is injury-outcome trials that ran 6–13 weeks to
4–6.7 km at 3 runs/week, and a tiny trial of starting dose in obese novices.
Commercial programs (e.g. Hal Higdon Novice 10K: 8 weeks, 3 runs/week from a
4-km base, long run 4.8 → 5.6 → 6.4 → 6.4 → 7.2 → 8.0 → 8.9 km → 10K race, all
"conversational", walk breaks allowed) are expert opinion and routinely take
12–17% steps early on and a 12% jump on race day. **Inference:** at two
runs/week with ≤10% long-run steps and two shallow down weeks, 5 → 10 km takes
9–11 weeks; the remaining ladder (wk 6–14 = 9 weeks) is inside that window
once the week-5 spike is fixed. A 6:40/km pace at 5 km is a normal novice
base; what is thin is tissue history, not aerobic fitness. His mass does not
change the number of rungs; it removes the option of skipping any and argues
against adding speed.

Evidence:
- Buist et al. 2008 · RCT · novices (adults training for a 4-mile / 6.7 km
  event, 3 runs/wk) · n = 532 · 13-week graded program built on the 10% rule
  vs 8-week standard: **no difference in injury (≈20% in each arm)** ·
  confidence high for the null. https://pubmed.ncbi.nlm.nih.gov/17940147/
- Bredeweg et al. 2012 · RCT · novices · n = 432 · 4-week walking/hopping
  preconditioning before a 9-week program vs none: injury 15.2% vs 16.8%,
  p = 0.69 · confidence high for the null — "pre-strengthening" the tissues
  with low-impact work did not help. https://pubmed.ncbi.nlm.nih.gov/22842237/
- Kluitenberg et al. 2015 · prospective cohort · novices in a 6-week
  supervised Start to Run program · n = 1,696 · **10.9% injured within 6
  weeks** (hampered ≥3 consecutive sessions) · confidence high.
  https://pubmed.ncbi.nlm.nih.gov/25438823/
- Bertelsen et al. 2018 · RCT · obese novices (BMI 30–35, 75% female) · n = 56 ·
  start 3 × 1 km/wk vs 3 × 2 km/wk, ~10%/wk progression, 4 weeks: ITT injury
  6.9% vs 18.5% (RD −16.3%, 95% CI −43.8 to 11.3, p = 0.25); per-protocol RD
  −31.2% (−57.0 to −5.2) · 7 injuries, 45–52% compliance · confidence low, but
  the only trial of starting dose in heavy beginners and it points to "start
  lower". https://pmc.ncbi.nlm.nih.gov/articles/PMC6253747/
- Videbæk et al. 2015 · systematic review + meta-analysis · 13 studies ·
  **novices 17.8 injuries/1000 h (95% CI 16.7–19.1) vs recreational 7.7
  (6.9–8.7)** · confidence high. https://pubmed.ncbi.nlm.nih.gov/25951917/
- Damsted et al. 2019 (ProjectRun21) · prospective cohort · half-marathon
  schedule followers · n = 784 · runners with <15 km/week experience and/or
  slower than 6:00/km tended to more injury (RD −11.3% and −17.4% favouring the
  more experienced/faster; CIs cross 0) · confidence low; he sits in both
  low-capacity groups. https://pubmed.ncbi.nlm.nih.gov/30190100/
- Hal Higdon, Novice 10K (expert tier; opened) · 8 weeks · 3 runs + 2 cross-
  training days · long-run sequence above.
  https://www.halhigdon.com/training-programs/10k-training/novice-10k/

### 2. Injury risk and load progression

**Finding.** What changed in 2024–2026: the field moved from *weekly ratios*
(10% rule, ACWR) to *single-session distance relative to recent history*. The
10% weekly rule failed its only RCT; ACWR is statistically unsound and, in the
largest running dataset, inversely associated with injury; the session-vs-
30-day-longest exposure is the one with a clear signal. For novices the older
Aarhus cohort still says very large weekly jumps (>30%) matter for
distance-type injuries. Body mass is a replicated novice risk factor that
disappears in experienced runners — exactly what tissue adaptation predicts.
Bone mechanics give the reason: fatigue life falls by half for every 10% rise
in strain, and strain rises with mass and with speed.

Evidence:
- Frandsen et al. 2025 · prospective cohort (Garmin-RUNSAFE) · **experienced
  recreational: median 9.5 y running, mean age 45.8, 78% male, BMI 24.2 ± 3.6**
  · n = 5,205; 588,071 sessions; 1,820 (35%) injured over 18 months ·
  Exposure 1, session distance ÷ longest in prior 30 days (reference ≤+10%):
  **>10–30% HRR 1.64 (1.31–2.05); >30–100% 1.52 (1.16–2.00); >100% 2.28
  (1.50–3.48)**. Exposure 2, ACWR (1 wk : 3 wk): 0.94, 0.87, **0.75
  (0.59–0.96)** — inverse. Exposure 3, week-to-week: 0.97, 0.88, 0.91 — null ·
  injury self-reported (pain reducing running) · authors: window arbitrary,
  no subgroup analysis possible (sparse data), intensity not captured,
  RCTs needed · confidence high for the association in this population,
  moderate for transfer to a novice.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12421110
- Nielsen et al. 2014 · prospective cohort · **novices**, self-structured,
  GPS · n = 874, 202 injured · weekly progression <10% / 10–30% / >30%: no
  overall difference; **distance-related injuries HR 1.59 (0.96–2.66),
  p = 0.07 for >30% vs <10%** · confidence moderate–low (imprecise,
  exploratory). https://pubmed.ncbi.nlm.nih.gov/25155475/
- Damsted et al. 2018 · systematic review · 4 studies · "very limited
  evidence" that a sudden change in load predicts injury; **no difference
  between 10% and 24% average weekly increases (HR 0.8, 0.6–1.3)** ·
  confidence high that the *weekly-%* literature is weak.
  https://pubmed.ncbi.nlm.nih.gov/30534459/
- Impellizzeri et al. 2020 · methods critique · ACWR: mathematical coupling,
  sparse-data bias, arbitrary windows, no causal evidence · confidence high
  that ACWR is not a decision rule. https://pubmed.ncbi.nlm.nih.gov/32502973/
- Buist et al. 2010 · prospective cohort · novices · n = 532 (226 men) ·
  **men: BMI HR 1.15 per kg/m² (1.05–1.26); previous injury HR 2.7
  (1.36–5.55)** · confidence moderate–high. https://pubmed.ncbi.nlm.nih.gov/19966104/
- Nielsen et al. 2013 · DANO-RUN cohort · novices (mean BMI 26.3) · n = 930,
  254 injured over 155,318 km (≈1.6/1000 km) · **BMI >30 higher risk, BMI <20
  protective (χ² across groups p = 0.06)**; previous non-running injury and age
  45–65 clinically relevant; sex, experience, other sport: none · confidence
  moderate. https://doi.org/10.1177/2325967113487316
- Kluitenberg 2015 (above) · multivariable Cox in 1,696 novices: **higher BMI,
  higher age, previous non-sport musculoskeletal complaints, no prior running
  experience** all associated with injury · confidence high.
- Malisoux et al. 2020 · RCT (secondary) · **recreational** · n = 848 · **body
  mass not associated with injury (SHR 1.00, 0.99–1.01)** · confidence high.
  https://pubmed.ncbi.nlm.nih.gov/31877062/
- van Gent et al. 2007 · systematic review · long-distance runners · strong
  evidence for previous injury and (men) high weekly distance as risk factors
  · confidence moderate. https://pubmed.ncbi.nlm.nih.gov/17473005/
- Burke et al. 2023 (RISC) · prospective cohort · recreational · n = 258, 51%
  injured in 12 months · multivariable: previous injury <1 y, marathon
  training, less knee valgus, greater contralateral thorax drop · confidence
  moderate; previous injury is the one consistent predictor across every
  cohort. https://pubmed.ncbi.nlm.nih.gov/37310517/
- Warden, Edwards & Willy 2021 · narrative review (mechanistic; tier 4/5) ·
  **microdamage accumulation rises with strain^17; a 10% increase in tissue
  strain halves cycles to failure**; model: same distance at 2.5 vs 3.5 m/s
  halved tibial BSI likelihood → "safer to initially increase volume than
  intensity"; osteoclastic resorption ~4 weeks, replacement ~3 months, full
  mineralisation up to a year, with transient porosity in between; **BSIs
  appear ~3–4 weeks after a workload error**; ≥1 rest day/week; mechano-
  sensitivity restored by 4–8 h rest between bouts; lowest step-rate quartile
  6.7× shin injury (cited cohort) · confidence moderate for mechanism, low as a
  prescription. https://pmc.ncbi.nlm.nih.gov/articles/PMC8316280/
- Campbell et al. 2025 · systematic review · military recruits · 70 studies ·
  recruit BSI incidence far exceeds qualified personnel; risk: no prior
  exercise ≥3 sessions/week, underweight BMI, low vitamin D, NSAID use, "the
  initial training stages with the greatest physical loading" · confidence
  moderate; marching + running, not runners.
  https://pubmed.ncbi.nlm.nih.gov/41302705/
- Warden, Davis & Fredericson 2014 · expert synthesis (level 5) · BSI
  prevention: program design, softer landing / higher stride rate, calf
  strength (tibia), foot intrinsics (metatarsals).
  https://pubmed.ncbi.nlm.nih.gov/25103133/

**Does high mass and muscularity change the picture?** *Inference from the
above, not direct evidence.* Ground reaction force scales with body mass
(≈2.5–3 × BW per step at easy pace), so per-step bone and tendon strain is
higher for him than for the 78-kg median runner; with fatigue life halving per
10% strain, a runner 20% heavier at the same speed has roughly a quarter of the
cycles-to-failure on an unadapted skeleton. His lifting has built muscle and
tendon capacity, which plausibly buffers some of that (muscle absorbs load
before bone), but tibial bending, eccentric calf loading at ~1,000 steps/km,
and the specific remodelling response are new. Treat him as the novice cohorts
(BMI a risk factor) for at least 3 months, and treat *speed* as the load he
must not add: it raises strain more than distance does.

**Is the 110%-of-longest-recent-run guard the right guard?** Right exposure,
right window (the only one studied), wrong number (1.15 in code), and it
should be the primary rule. Add a secondary weekly check (>30% jump flagged)
because that is the one rule that comes from novices. Do not add ACWR.

### 3. Time-based vs distance-based progression

**Finding.** No primary evidence was found for time-first prescription, for
distance-based prescription, or for any switch-over point; the search returned
only coaching blogs. Expert practice (Higdon, C25K, NHS) is split — Higdon is
distance-based from day one; C25K-type programs are time-based throughout.
The GRONORUN and NLstart2run trial programs were minute-based run/walk
schedules (novice RCTs), which is the closest thing to evidence that time-based
early prescription is at least safe. **Inference:** the mode does not matter;
what matters is (a) the load rule is a *distance* rule, so distance must be
logged and checked on every run whichever way it is prescribed (the app has
GPS, so it can), and (b) converting between modes must use the athlete's
actual pace — the week-5 spike is a conversion error, not a mode error. If
anything, keep the *easy* run time-based (it caps load automatically if he
slows down) and the *long* run distance-based (it is the run the guard is
about). Confidence: low (no evidence either way).

### 4. Intensity

**Finding.** For this block, everything easy is supported: the one novice
cohort that measured intensity found higher prior-week RPE → more injury;
bone fatigue mechanics say speed is the more dangerous load for a heavy
novice; and the polarised/threshold trials that show benefits are in
recreational runners 25 minutes faster over 10 km, with 8-week bases. No study
of strides in novices exists. Polarised training is a concept for runners with
enough volume to distribute — irrelevant at 2 runs/week. "Conversational" maps
cleanly onto validated instruments.

Evidence:
- Kluitenberg et al. 2016 · prospective cohort, time-varying Cox · novices ·
  n = 1,696 · **higher mean RPE in the previous 7 days → higher injury hazard**;
  frequency NS (trend 3×/wk > 2×/wk); lower volume → higher hazard (authors:
  counter-intuitive, probably confounded, "should not be used plainly as a
  guideline") · confidence moderate for the intensity signal.
  https://pubmed.ncbi.nlm.nih.gov/26452583/
- Ramskov et al. 2018 (Run Clever) · RCT · recreational · n = 447 · 8-wk base
  then 16 wk progressing high-intensity running (≥88% VO2max) vs progressing
  volume: **no difference** in overall or type-specific injury (RD −5.1% and
  −3.4% at 16 wk, CIs cross 0) · confidence moderate; not novices, both arms
  had 8 weeks of base first. https://www.jospt.org/doi/abs/10.2519/jospt.2018.8062
- Festa et al. 2020 · RCT · recreational · n = 38 · 8 wk polarised (77/3/20)
  vs "focused" (40/50/10), TRIMP-matched: equal gains in vVO2max, VT, 2-km;
  focused used 17% less time · confidence moderate; not novices.
  https://pubmed.ncbi.nlm.nih.gov/33344993/
- Muñoz et al. 2014 · RCT · recreational, 10K ≈ 39 min · n = 30 · polarised
  vs between-thresholds: 5.0% vs 3.6% improvement, NS · confidence: low
  relevance. https://pubmed.ncbi.nlm.nih.gov/23752040/
- Warden 2021 (above): speed 3.5 → 2.5 m/s at equal distance halved modelled
  tibial BSI likelihood; "high volume, low velocity" for the mature skeleton
  during progression.
- Bok, Rakovac & Foster 2022 · narrative review · **Talk Test and RPE are valid
  markers of VT1 and RCP**; "equivocal" Talk-Test stage and Borg 10–11 ≈ VT1;
  "negative" stage and Borg 13–15 ≈ RCP · confidence high.
  https://pubmed.ncbi.nlm.nih.gov/35507232/
- Condello et al. 2014 · n = 31 + 20 · running below VT ≈ ≤64% of max test
  speed: stable lactate ~2.5 mmol/L, CR10 ~3–3.5, "able to speak comfortably"
  for 30 min · confidence moderate. https://pubmed.ncbi.nlm.nih.gov/24790484/
- Strides: no novice or recreational injury/performance trial found; sprint
  and plyometric economy studies are in highly trained runners. Expert
  practice (Daniels, Magness) uses 4–8 × 20 s after easy runs; tier 5.

Operationalising "conversational": (1) can speak a full ~10-word sentence
without a breath pause at any point in the run; (2) CR10 RPE 3–4 during, ≤4
at the end; (3) if either fails, walk 60 s and resume slower. At 6:40/km a
novice may already be near VT1 — the instruction is "slow down or walk", not
"hold the pace". Walk breaks do not fail a rung (Hottenrott 2016: run/walk
gave the same marathon time with less muscle pain in non-elites).

### 5. Frequency

**Finding.** Two runs a week reaches 10 km in the 9–11-week window; the
aerobic system is not the limiter. Direct frequency-vs-injury evidence in
beginners is one non-significant trend against 3×/wk (Kluitenberg 2016);
nothing else was found in primary literature, and the widely repeated "risk
rises sharply above 3 sessions/week" claim traces to blogs. Maintenance data
(2 sessions/week hold endurance ≥15 weeks with intensity kept) support 2 as a
floor. **What a third run buys:** more chronic distance under the long run,
faster economy gains, the long run becoming ~50% rather than ~65% of the week.
**What it costs:** a third impact exposure in the highest-risk window on a
skeleton where fatigue life halves per 10% strain; and one fewer recovery day
between Lower (Mon) and the Tue easy run — the concurrent-training
specialist's call. Bone mechanosensitivity recovers within 4–8 h (Warden
2021), so spacing rather than count is what bone cares about; connective
tissue and the total cycle count are the real cost.

Evidence: Kluitenberg 2016 (above) · Hickson & Rosenkoetter 1981 · n = 12
untrained young adults · 10 wk at 6 d/wk then 15 wk at 2 or 4 d/wk with
intensity and duration held: VO2max maintained at both · confidence moderate.
https://pubmed.ncbi.nlm.nih.gov/7219129/ · Spiering et al. 2021 · narrative
review · endurance maintained ≤15 wk at 2 sessions/wk or with 33–66% volume
reduction if intensity kept · confidence moderate.
https://pubmed.ncbi.nlm.nih.gov/33629972/

### 6. Long-run progression and down weeks

**Finding.** Increment audit against the 30-day-longest rule at his pace:

| Rung | Long run | Longest in prior 30 d | Ratio | Weekly km | Δ week |
|---|---|---|---|---|---|
| wk 5 | 6.0 km | 5.25 km (wk 3) | **1.14** | 9.0 | — |
| wk 6 | 6.5 | 6.0 | 1.08 | 10.0 | +11% |
| wk 7 | 7.0 | 6.5 | 1.08 | 11.0 | +10% |
| wk 8 (down) | 5.0 | — | — | 9.0 | −18% |
| wk 9 | 7.5 | 7.0 | 1.07 | 11.5 | **+28%** |
| wk 10 | 8.0 | 7.5 | 1.07 | 12.5 | +9% |
| wk 11 | 8.5 | 8.0 | 1.06 | 13.0 | +4% |
| wk 12 (down) | 6.0 | — | — | 10.0 | −23% |
| wk 13 | 9.3 | 8.5 | 1.09 | 14.3 | **+43%** |
| wk 14 | 10.0 | 9.3 | 1.08 | 15.0 | +5% |

Every rung after week 5 complies with the session rule. No study tests
down-week depth or placement in runners. The rationale is bone remodelling:
resorption ~4 weeks after a load step, transient porosity, BSIs surfacing at
3–4 weeks (Warden 2021), which supports an unloading week every 3rd–4th week
and, separately, supports Warden's "≥1 rest day per week". The 30-day window
means a down week two weeks before a rung does not lower the reference, so
down weeks are free from the spike rule's point of view — but they create the
weekly rebound. **Keep the cadence (every 4th week); set the down-week long
run at ~80% of the preceding week (5.5–6 km at wk 8, 7 km at wk 12); cut the
easy run instead if more recovery is needed.** That caps every weekly rise at
~25%. Confidence: low–moderate (inference from mechanism + the novice weekly
cohort).

### 7. Supporting factors with evidence

Ranked by the quality of evidence *for injury outcomes*:

- **Gait retraining to land softer — one RCT in novices, large effect.** Chan
  et al. 2018 · RCT · novices · n = 320 · 2 weeks of treadmill running with
  real-time vertical-loading-rate feedback vs treadmill running without:
  loading rate fell (d > 0.99); **12-month injury 16% vs 38%, HR 0.38
  (0.25–0.59)** · confidence moderate — single lab, unreplicated; the cue is
  free. https://pubmed.ncbi.nlm.nih.gov/29065279/
- **Cadence — mechanistically sound, prospectively unproven.** Schubert et al.
  2014 · systematic review, 10 studies · higher step rate at constant speed
  reduces GRF, COM excursion and hip/knee/ankle energy absorption ·
  confidence high for mechanics. https://pubmed.ncbi.nlm.nih.gov/24790690/
  Malisoux et al. 2022 · prospective (secondary of RCT) · recreational ·
  n = 848 · **step rate, loading rate and impact peak were not injury risk
  factors**; longer step length (SHR 1.01/cm) and lower duty factor (SHR 0.95)
  were, weakly · confidence moderate. https://pubmed.ncbi.nlm.nih.gov/35049407/
  Keast et al. 2022 · meta-analysis · tibial load rises with stride length
  (SMD 0.86), speed (1.03), barefoot (1.16), unfamiliar minimalist shoes
  (0.89), motion-control shoes (0.46); falls with treadmill vs overground
  (−0.83) and biofeedback (−0.93) · confidence moderate.
  https://pubmed.ncbi.nlm.nih.gov/35708887/
  Net: cadence per se is not a lever unless very low (<160 spm); "shorter,
  quicker, quieter" is the same intervention as Chan's.
- **Footwear cushioning — one RCT, effect confined to lighter runners.**
  Malisoux et al. 2020 · RCT · recreational · n = 848 · hard midsole SHR 1.52
  (1.07–2.16) overall; lighter runners SHR 1.80 (1.09–2.98); **heavier men
  (>78.2 kg) SHR 1.23 (0.75–2.03), NS** · confidence moderate. For him:
  cushioning is cheap insurance, not a proven lever; the point estimate still
  favours it. https://pubmed.ncbi.nlm.nih.gov/31877062/
- **Heel drop — no overall effect.** Malisoux et al. 2016 · RCT · leisure
  runners · n = 553 · 10 vs 6 vs 0 mm: no overall difference; occasional
  runners (<6 months weekly practice) lower risk in low-drop (HR 0.48,
  0.23–0.98), regular runners higher (HR 1.67, 1.07–2.62) · confidence low for
  the subgroup; do not change drop mid-block.
  https://pubmed.ncbi.nlm.nih.gov/27501833/
- **Shoe age / changing shoes.** Only signal found: RISC 2023 (above) —
  changing shoes every 0–3 months was associated with injury in univariate
  analysis, almost certainly reverse causation. No evidence for a km limit.
- **Foot-intrinsic ("foot core") strength — one RCT, large effect.** Taddei et
  al. 2020 · RCT · recreational · n = 118 · 8-week foot-ankle program then
  remote maintenance: control **2.42× (1.98–3.62)** more likely injured over 12
  months · confidence moderate — single trial; cheap.
  https://pubmed.ncbi.nlm.nih.gov/33156692/
- **Generic strength programs — null in two RCTs and a pilot.** Baltich et al.
  2017 · pilot RCT · novices · n = 129 · resistance vs functional vs stretching:
  31.6 vs 32.9 vs 26.7 injuries/1000 h, no difference, high dropout.
  https://pubmed.ncbi.nlm.nih.gov/27486011/ Toresdahl et al. 2020 · RCT ·
  first-time marathoners · n = 720 · 10-min hip/quad/core 3×/wk: overuse
  injury causing non-completion 7.1% vs 7.3%, RR 0.97 (0.57–1.63).
  https://pubmed.ncbi.nlm.nih.gov/31642726/ Nguyen et al. 2024 · pilot RCT ·
  novices · n = 74 · strengthening replacing some running vs running only: no
  difference (p = 0.08), 40–50% attrition.
  https://pubmed.ncbi.nlm.nih.gov/38251299/ Confidence moderate that generic
  unloaded home programs do nothing; he already trains legs heavily, so this
  is moot for him.
- **Calf strength for tibial BSI** — Warden 2014/2021 expert synthesis; his
  2 × 10–15 calf raises already cover it. Consider slow, heavy, full-range
  (tier 5).
- **Surface — biomechanics only, no injury outcomes.** Mitchell et al. 2025 ·
  meta-analysis, 22 studies, n = 392 · softer surfaces lower peak tibial
  acceleration (SMD −0.8, −1.42 to −0.18) but not GRF, loading rate or contact
  time · confidence moderate for mechanics, none for injury.
  https://pubmed.ncbi.nlm.nih.gov/37477226/ Keast 2022: treadmill lowers
  tibial load vs overground. Practical: a treadmill or softer surface for the
  long run is a reasonable *response* to shin symptoms, not a routine.
- **Warm-up — folklore for injury prevention in runners.** No RCT with injury
  outcomes in runners was found; Kemler et al. 2021 (RCT, n ≈ 1,400 novices)
  only shows an online tool changed warm-up *behaviour*. 3–5 min of walking
  into the run is harmless and costs nothing; do not claim it prevents injury.
  https://pubmed.ncbi.nlm.nih.gov/36816902/
- **Previous injury is the one predictor found in every cohort** (Buist 2010
  HR 2.7; Nielsen 2013; Kluitenberg 2015; van Gent 2007; RISC 2023). The app
  should ask about it and treat any prior lower-limb injury as a reason to
  hold rungs longer.

### 8. What to measure

Earns its place (each maps to a rule with evidence behind it):
1. **Longest run in the previous 30 days and the ratio of every planned or
   logged run to it** (Frandsen 2025) — already computed; show it on the run
   card and apply it to time-based runs via GPS distance.
2. **Post-run CR10 RPE and a Talk-Test yes/no** (Kluitenberg 2016; Bok 2022) —
   an easy run at RPE ≥ 5 is the one training variable that tracked injury in
   novices.
3. **Pain 0–10 by site (shin, knee, Achilles/calf, foot) during, after, and
   next morning.** Every cohort defines injury as *reduced running*; the
   consensus definition is pain restricting running ≥7 days or 3 sessions
   (Yamato 2015). The app should catch it earlier: pain ≥ 3 that persists to
   the next morning or worsens during a run → repeat the rung; focal bone
   tenderness (shin, metatarsal) → stop and get assessed (Warden 2014/2021).
4. **Gaps ≥ 10 days** — the 30-day reference decays and the next run becomes
   a spike by definition; re-enter one rung down.
5. **Weekly total and week-to-week change** — flag > +30% (Nielsen 2014); not
   a target.
6. **Previous lower-limb injury (once, at setup)** — HR ≈ 2–3 in every cohort.

Noise for this athlete: HRV, resting HR, per-run cadence, pace variability,
calories, ACWR/TRIMP "training load" scores. Pace is worth keeping only as a
check that easy runs are not creeping faster, and to convert time rungs to km
correctly.

### 9. After the 10K

**Finding.** Maintenance is cheap if intensity is kept and expensive if it is
not. Hickson 1981 and Spiering 2021: 2 sessions/week, or a 33–66% cut in
volume, preserve endurance ≥15 weeks when intensity is maintained. Applied
here: **one 7–8 km easy run + one 4–5 km run that includes 6–8 × 20–30 s
strides or 3–4 × 2 min "comfortably hard" (Talk Test negative, CR10 6–7)**
holds 10K fitness at ~12 km/week with a smaller biggest-session load than
5 + 10 km. Introduce the faster segments only *after* the 10K and only after
~3 months of consistent running (bone remodelling timeline). Continued
progression (faster 10K, longer) is a different goal that competes with goals
1–2; not recommended unless asked for. Confidence: moderate (untrained-
population data; the principle is consistent).

## Recommendations for this athlete

1. **`SPIKE_LIMIT` 1.15 → 1.10.** Apply it to every logged run (GPS distance),
   including time-based ones. Reword the warning as "associated with".
2. **Next long run 5.5 km, not 6.** Then 6 → 6.5 → 7 → (down 5.5–6) → 7.5 →
   8 → 8.5 → (down 7) → 9.3 → 10. Ten weeks if he is at 5 km today.
3. **Down weeks:** long run ~80% of the previous week; easy run unchanged or
   dropped; no week's total more than ~25–30% above the one before.
4. **Intensity:** every run Talk-Test positive, CR10 3–4; walk breaks allowed
   and do not fail a rung. No strides, no "pick-ups", no tempo until after the
   10K and ≥3 months of running.
5. **Frequency:** two runs remain the plan. The optional third is 20–25 min
   easy, never a progression, and is the first thing dropped when any pain or
   leg-day fatigue rises. Never run on consecutive days in this block.
6. **Gait and shoes, once:** cue "quieter landing, slightly shorter step"; if
   easy-pace cadence is under ~160 spm aim for +5%. Run in a cushioned,
   standard-drop (8–10 mm) trainer; no drop or minimalist experiments
   mid-block.
7. **Foot-intrinsic work** (short-foot holds, toe-flexor work, single-leg
   balance; ~5 min, twice a week) in the core slot. Keep the calf raises;
   make them slow and full-range.
8. **Track:** 30-day-longest ratio, RPE, Talk Test, site-specific pain (run /
   after / next morning), gaps, previous injury. Hold the rung on next-morning
   pain ≥ 3/10; stop on focal bone pain.
9. **After the 10K:** 7–8 km easy + 4–5 km with strides or short comfortably-
   hard segments, ~12 km/week; re-test 10 km once a quarter if he wants proof.

## Conflicts, uncertainties and open questions

- **Session spike (Frandsen 2025, experienced) vs weekly jump (Nielsen 2014,
  novices).** Different exposures, different populations; not contradictory,
  but a plan can satisfy one and violate the other (wk 12→13 does). The novice
  result is weak (p = 0.07) — honour both because the cost is zero, not
  because the weekly evidence is strong.
- **Weekly-progression evidence is thin in both directions.** Buist 2008's
  faster arm was no worse; Damsted 2018 found 10% vs 24% weekly identical. If
  the session rule is the real mechanism, the weekly rule is redundant; it is
  kept here only as a cap on down-week rebounds.
- **Frequency.** The only novice data trend against 3×/wk and, paradoxically,
  against low volume. If a third easy run were shown to lower injury in
  novices, recommendation 5 would flip to "third run default".
- **Body mass.** All novice evidence is BMI, confounded with adiposity. If
  lean mass carried none of the risk, the timeline could be compressed by a
  week or two; no data say so, and force ∝ mass says otherwise. If he has any
  prior lower-limb injury, every hold rule above gets stricter.
- **Cushioning in heavy runners:** the >78 kg stratum was non-significant with
  a CI spanning a 25% *reduction* to a 2× *increase* in risk with hard shoes;
  the reading is "cushioning is unlikely to hurt".
- **Cadence:** mechanics say yes, the prospective cohort says no, and Chan
  2018 changed loading rate, not cadence directly. A cue, not a metric.
- **Time vs distance:** no evidence; the recommendation is a logging
  requirement, not a prescription mode.
- **Frandsen 2025 could not adjust for intensity**; a spike in distance run
  slowly may not be the same exposure as a spike at pace. For a novice
  running everything easy this probably makes the guard conservative, which
  is the right direction.
- **Concurrent-training constraint (not this domain):** Sat long run → Sun
  Shoulders & Arms → Mon Lower → Tue easy run puts the easy run 24 h after
  leg day. If Tuesday RPEs run high, that is a scheduling interaction for the
  concurrent-training specialist, not a reason to change the ladder.

## Sources

- Frandsen et al. 2025. How much running is too much? Identifying high-risk
  running sessions in a 5200-person cohort study. *Br J Sports Med*.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12421110
- Nielsen et al. 2014. Excessive progression in weekly running distance and
  risk of running-related injuries: an association which varies according to
  type of injury. *JOSPT* 44(10):739. https://pubmed.ncbi.nlm.nih.gov/25155475/
- Nielsen et al. 2013. Predictors of running-related injuries among 930 novice
  runners. *Orthop J Sports Med*. https://doi.org/10.1177/2325967113487316
- Damsted et al. 2018. Is there evidence for an association between changes in
  training load and running-related injuries? A systematic review. *Int J
  Sports Phys Ther* 13(6):931. https://pubmed.ncbi.nlm.nih.gov/30534459/
- Damsted et al. 2019. ProjectRun21: do running experience and running pace
  influence the risk of running injury. *J Sci Med Sport* 22(3):281.
  https://pubmed.ncbi.nlm.nih.gov/30190100/
- Impellizzeri et al. 2020. Acute:chronic workload ratio: conceptual issues
  and fundamental pitfalls. *Int J Sports Physiol Perform* 15(6):907.
  https://pubmed.ncbi.nlm.nih.gov/32502973/
- Buist et al. 2008. No effect of a graded training program on the number of
  running-related injuries in novice runners: RCT. *Am J Sports Med*.
  https://pubmed.ncbi.nlm.nih.gov/17940147/
- Buist et al. 2010. Predictors of running-related injuries in novice runners
  enrolled in a systematic training program. *Am J Sports Med* 38(2):273.
  https://pubmed.ncbi.nlm.nih.gov/19966104/
- Bredeweg et al. 2012. The effectiveness of a preconditioning programme on
  preventing running-related injuries in novice runners: RCT. *Br J Sports
  Med* 46(12):865. https://pubmed.ncbi.nlm.nih.gov/22842237/
- Kluitenberg et al. 2015. The NLstart2run study: incidence and risk factors
  of running-related injuries in novice runners. *Scand J Med Sci Sports*.
  https://pubmed.ncbi.nlm.nih.gov/25438823/
- Kluitenberg et al. 2016. The NLstart2run study: training-related factors
  associated with running-related injuries in novice runners. *J Sci Med
  Sport* 19(8):642. https://pubmed.ncbi.nlm.nih.gov/26452583/
- Bertelsen et al. 2018. The start-to-run distance and running-related injury
  among obese novice runners: a randomized trial. *Int J Sports Phys Ther*.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC6253747/
- Videbæk et al. 2015. Incidence of running-related injuries per 1000 h of
  running in different types of runners: systematic review and meta-analysis.
  *Sports Med*. https://pubmed.ncbi.nlm.nih.gov/25951917/
- van Gent et al. 2007. Incidence and determinants of lower extremity running
  injuries in long distance runners: a systematic review. *Br J Sports Med*.
  https://pubmed.ncbi.nlm.nih.gov/17473005/
- Burke et al. 2023. Aetiological factors of running-related injuries: a
  12-month prospective RISC study. *Sports Med Open* 9:46.
  https://pubmed.ncbi.nlm.nih.gov/37310517/
- Warden, Edwards & Willy 2021. Preventing bone stress injuries in runners
  with optimal workload. *Curr Osteoporos Rep* 19(3):298.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC8316280/
- Warden, Davis & Fredericson 2014. Management and prevention of bone stress
  injuries in long-distance runners. *JOSPT* 44(10):749.
  https://pubmed.ncbi.nlm.nih.gov/25103133/
- Campbell et al. 2025. Incidence and risk factors for the development of
  stress fractures in military recruits and qualified personnel: a systematic
  review. *Int J Environ Res Public Health* 22(11):1760.
  https://pubmed.ncbi.nlm.nih.gov/41302705/
- Ramskov et al. 2018. Progression in running intensity or running volume and
  the development of specific injuries in recreational runners: Run Clever.
  *JOSPT* 48(10). https://www.jospt.org/doi/abs/10.2519/jospt.2018.8062
- Festa et al. 2020. Effects of different training intensity distribution in
  recreational runners. *Front Sports Act Living* 1:70.
  https://pubmed.ncbi.nlm.nih.gov/33344993/
- Muñoz et al. 2014. Does polarized training improve performance in
  recreational runners? *Int J Sports Physiol Perform* 9(2):265.
  https://pubmed.ncbi.nlm.nih.gov/23752040/
- Bok, Rakovac & Foster 2022. An examination and critique of subjective
  methods to determine exercise intensity: the Talk Test, Feeling Scale, and
  RPE. *Sports Med* 52(9):2085. https://pubmed.ncbi.nlm.nih.gov/35507232/
- Condello et al. 2014. A simplified approach for estimating the ventilatory
  and respiratory compensation thresholds. *J Sports Sci Med* 13(2):309.
  https://pubmed.ncbi.nlm.nih.gov/24790484/
- Hottenrott et al. 2016. Does a run/walk strategy decrease cardiac stress
  during a marathon in non-elite runners? *J Sci Med Sport* 19(1):64.
  https://pubmed.ncbi.nlm.nih.gov/25467199/
- Hickson & Rosenkoetter 1981. Reduced training frequencies and maintenance of
  increased aerobic power. *Med Sci Sports Exerc* 13(1):13.
  https://pubmed.ncbi.nlm.nih.gov/7219129/
- Spiering et al. 2021. Maintaining physical performance: the minimal dose of
  exercise needed to preserve endurance and strength over time. *J Strength
  Cond Res* 35(5):1449. https://pubmed.ncbi.nlm.nih.gov/33629972/
- Chan et al. 2018. Gait retraining for the reduction of injury occurrence in
  novice distance runners: 1-year follow-up of an RCT. *Am J Sports Med*
  46(2):388. https://pubmed.ncbi.nlm.nih.gov/29065279/
- Schubert, Kempf & Heiderscheit 2014. Influence of stride frequency and
  length on running mechanics: a systematic review. *Sports Health* 6(3):210.
  https://pubmed.ncbi.nlm.nih.gov/24790690/
- Malisoux et al. 2016. Influence of the heel-to-toe drop of standard
  cushioned running shoes on injury risk in leisure-time runners: RCT. *Am J
  Sports Med* 44(11):2933. https://pubmed.ncbi.nlm.nih.gov/27501833/
- Malisoux et al. 2020. Shoe cushioning influences the running injury risk
  according to body mass: RCT involving 848 recreational runners. *Am J Sports
  Med* 48(2):473. https://pubmed.ncbi.nlm.nih.gov/31877062/
- Malisoux et al. 2022. Spatiotemporal and ground-reaction force
  characteristics as risk factors for running-related injury. *Am J Sports
  Med* 50(2):537. https://pubmed.ncbi.nlm.nih.gov/35049407/
- Keast, Bonacci & Fox 2022. Acute effects of gait interventions on tibial
  loads during running: systematic review and meta-analysis. *Sports Med*
  52(10):2483. https://pubmed.ncbi.nlm.nih.gov/35708887/
- Mitchell et al. 2025. The effect of surface compliance on overground running
  biomechanics: systematic review and meta-analysis. *Sports Biomech*
  24(5):1143. https://pubmed.ncbi.nlm.nih.gov/37477226/
- Taddei et al. 2020. Foot core training to prevent running-related injuries:
  survival analysis of a single-blind RCT. *Am J Sports Med* 48(14):3610.
  https://pubmed.ncbi.nlm.nih.gov/33156692/
- Baltich et al. 2017. Running injuries in novice runners enrolled in
  different training interventions: pilot RCT. *Scand J Med Sci Sports*
  27(11):1372. https://pubmed.ncbi.nlm.nih.gov/27486011/
- Toresdahl et al. 2020. A randomized study of a strength training program to
  prevent injuries in runners of the New York City Marathon. *Sports Health*
  12(1):74. https://pubmed.ncbi.nlm.nih.gov/31642726/
- Nguyen et al. 2024. A randomized pilot study comparing strengthening-based
  running training with only running on the incidence of running-related
  injuries among novice runners. *Sports (Basel)* 12(1):25.
  https://pubmed.ncbi.nlm.nih.gov/38251299/
- Kemler, Cornelissen & Gouttebarge 2021. The effectiveness of an online
  intervention in stimulating injury-preventive behaviour in adult novice
  runners: RCT. *S Afr J Sports Med* 33(1).
  https://pubmed.ncbi.nlm.nih.gov/36816902/
- Yamato, Saragiotto & Lopes 2015. A consensus definition of running-related
  injury in recreational runners: a modified Delphi approach. *JOSPT*
  45(5):375. https://pubmed.ncbi.nlm.nih.gov/25808527/
- Hal Higdon. Novice 10K training program (expert tier).
  https://www.halhigdon.com/training-programs/10k-training/novice-10k/
