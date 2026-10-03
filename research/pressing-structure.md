# Overhead press: barbell vs dumbbell — should the heavy day change?

Continues from `research/pressing-asymmetry.md`, whose conclusions stand and are not
re-derived here: no trial shows correcting a sub-clinical pressing asymmetry improves
anything; the 10–15% asymmetry thresholds are convention with test-noise the same size
as the signal; ~11.6% dominant-side-stronger (range 2.1–19.5%, more at the shoulder) is
the null hypothesis, not a finding. This file answers one narrower, concrete question:
**should standing barbell OHP be replaced by dumbbell shoulder press "for a while" so
both sides work independently?** The clinical/pain question is explicitly off the table
per the athlete's own instruction.

I am not a clinician. Nothing here is a diagnosis.

## Evidence access, stated first

Most primary sources below are the same ones opened for `pressing-asymmetry.md`
(Kassiano 2025, Wong 2024, Saeterbakken 2020 offset-loading, the offset-loading
hypertrophy papers) and are not re-opened. New for this file:

- **Opened as full page:** the NSCA *Strength and Conditioning Journal* 2022 review
  "Transfer Between Lifts" (Mang, Kravitz, Beam) — PDF fetched and read directly.
- **Opened as abstract/search-summary only** (paywalled or cookie-walled): Saeterbakken
  & Fimland 2013, *Effects of body position and loading modality on muscle activity and
  strength in shoulder presses* (PubMed 23096062) — blocked by a cookie wall, read only
  via search-engine summary; Saeterbakken et al. 2016, *Effect of*[chest-press]*
  stability requirements... time-course of task specificity* (PubMed 27671996,
  Springer/EJAP, paywalled, read only via search-engine summary); the 2025 *Sports
  Medicine* task-specificity meta-analysis (Saeterbakken et al., PMC12296774 — fetch
  redirected and was not re-tried; read via search summary and the article's own
  abstract text returned by the search tool).
- **Could not find:** any study of dumbbell-shoulder-press-to-barbell-OHP retraining
  after a deliberate exercise substitution in trained lifters; any study of visual
  trap/lat/shoulder-girdle size asymmetry and its response to unilateral pressing; any
  study of standing barbell OHP bar-tilt, lockout asymmetry, or its relationship to
  dumbbell-press history.
- About 8 searches, narrowly targeted, on top of the prior file's ~16.

## Summary

1. **The premise is still unmeasured.** `research/movement-asymmetry-metrics.md`
   tried and failed to extract bar tilt from the athlete's own OHP footage — no
   sleeve markers, no level camera, a crossmember defeating three tracking attempts.
   No number exists. What exists is a felt visual impression of the shoulder/trap
   area and lats, which `research/physique-metrics.md` already found unreliable for
   calling anything "lagging" (posture, not just muscle, drives apparent silhouette
   width), and which sits inside a normal, well-documented baseline asymmetry
   (11.6% average, more at the shoulder — Foley 2025, n = 9,327, moderate confidence
   it is normal). **Changing the main pressing lift in response to this is treating
   an impression as a finding.**
2. **Independent-arm pressing has a real mechanism for a strength-expression
   asymmetry, and a much weaker one for a size asymmetry.** A barbell lets the
   stronger side compensate through trunk lean, bar tilt or scapular shift while the
   weaker side coasts; symmetric-load EMG in trained bodybuilders shows exactly this
   (dominant pec 51% vs 35% MVIC at a *symmetric* 70% 1RM bench load, n = 10,
   Frontiers 2025, low-moderate confidence — cited in the prior file). Dumbbells
   remove that compensation route, so if the visible unevenness comes from one side
   doing less work in the bilateral lift, independent loading could in principle
   redistribute stimulus. The only hypertrophy-outcome evidence for this mechanism
   is a single 4-week ultrasound study in bench press (0.20 vs 0.13 cm pec growth,
   offset loading closed the gap) — tiny effect, near the measurement floor, search-
   summary only, low-moderate confidence (prior file, §3a).
3. **The athlete's own weighted pull-up is the test case the "independent loading
   fixes it" theory has already failed, or at least never confirmed.** A pull-up bar
   fixes hand position but nothing else: the torso is free to shift, and either lat
   can do more or less of the work exactly as a barbell presser can lean or tilt.
   He has trained this "already unilateral-adjacent" lift for years under full
   bodyweight-plus-load and still reports felt lat asymmetry. That is evidence
   against, not for, the claim that letting-sides-work-independently resolves a felt
   asymmetry — it is at least equally consistent with "independent loading lets an
   existing pattern keep expressing itself in load or reps, without correcting it,"
   which is the athlete's own candidate explanation and the one the data (such as it
   is) actually supports.
4. **A full T1 replacement is expensive in a specific, quantifiable way, and the
   expense buys nothing extra over the already-cheaper option.** The heavy-day
   reference (`blockReference()`, `src/core/progression.js`) is monotone, keyed to
   the OHP exercise id, and has no substitution path (`historyAliasDayKey` moves an
   exercise between days, not to a different exercise). Replacing Sunday's OHP with
   a dumbbell press variant for N weeks means the named-goal reference simply stops
   accumulating for N weeks; on return there is no history under the barbell OHP id,
   so the engine treats it exactly as it would a brand-new athlete on that lift —
   cold-start probe, full re-entry sequence, no shortcut. This is a direct
   application of the project's own stated engine invariant, not new research.
5. **The volume-day substitution already recommended in `pressing-asymmetry.md` §5
   answers essentially all of what "let both sides work independently" is asking
   for, at a small fraction of the cost**, because Wednesday's OHP (day A,
   `double_progression`, 3×6-8) does not feed the monotone reference and can be
   substituted and reverted freely. A full T1 swap adds cost without adding
   capability the T2 swap doesn't already have.
6. **Verdict: do not replace barbell OHP as the heavy-day (T1) lift.** If the cheap
   assessment in `pressing-asymmetry.md` §2 (two-day single-arm test, film) replicates
   a strength or control deficit, substitute single-arm dumbbell or seated DB press
   on the volume day only, per that file's existing recommendation. Do nothing to
   Sunday. This was already the answer; this file's job was to check whether the
   stronger ask (a full swap, motivated by appearance rather than a measured deficit)
   changes it, and it does not.

## Findings

### Q1 — Does independent-arm pressing mechanistically address what he's describing?

**If the concern is a strength-expression asymmetry (one side doing more of the work
in the bilateral lift): plausibly yes, with caveats.** Removing the rigid coupling of
a barbell forces each arm to produce its own force; it cannot be masked by trunk lean
or bar tilt the way it can in the barbell lift. This is inference from the mechanics,
not a tested outcome — I found no trial that put trained lifters through a barbell OHP
vs DB press substitution and measured a strength-asymmetry outcome.

**If the concern is a structural/size asymmetry — which is what "my traps/lats look
uneven" actually is — the mechanism is weak and the evidence thinner still.**
Hypertrophy responds to tension, volume and proximity to failure delivered to the
muscle, not to whether the external load happens to be in one hand or two. The only
plausible causal chain is: (a) the bilateral lift currently under-loads one side via
compensation, (b) that chronic under-loading has produced a real, visible size
difference, and (c) removing the compensation route re-distributes stimulus enough,
for long enough, to change it. Each link is unproven for this athlete:

- (a) is unmeasured — no film, no tilt number (`research/movement-asymmetry-metrics.md`).
- (b) is unmeasured — no validated home method exists for shoulder/trap/lat size
  asymmetry (`research/physique-metrics.md`); tape works for arms and calves, not torso.
- (c) has one small, search-summary-only 4-week ultrasound result in the *pec*, not the
  delt or trap, with an effect size near the method's own noise floor.

- **Source · design · population · n · effect · confidence:**
  - Offset-loading bench press ultrasound study — search-summary only, 4-week
    mesocycle — men, 5+ years bench experience, bench ≥ bodyweight — n ≈ 20–21 —
    traditional loading grew dominant pec more (0.20 vs 0.13 cm); offset loading
    removed the gap — **low-moderate**, prior file §3a.
  - Frontiers 2025 symmetric-load EMG — randomised crossover, acute — collegiate male
    bodybuilders, 4.55 y training — n = 10 — dominant pec 51% vs 35% MVIC, dominant
    anterior delt 48% vs 33% MVIC at symmetric 70% 1RM — **low-moderate**, prior file.
  - Kassiano 2025 — systematic review + meta-analysis, 9 studies — mixed trained
    populations — unilateral and bilateral training produce **equal hypertrophy**;
    strength follows the pattern trained (bilateral training → bigger bilateral-
    strength gain, unilateral → bigger unilateral-strength gain) — **moderate**,
    already in prior file §4a. This is the clearest single piece of evidence against
    expecting a hypertrophy benefit specifically from switching to unilateral
    pressing: if growth is equal either way, there is no hypertrophy argument for the
    swap, only (at best) a redistribution argument that depends on (a)–(c) above
    being true.

**The pull-up precedent, argued plainly (not previously researched, reasoned from the
engine and anatomy facts already on record):** a weighted pull-up already removes the
barbell's rigid two-hand coupling in exactly the dimension OHP would gain from a DB
swap — each hand/arm/lat produces its own force, and the torso is free to shift so one
side can do more. If "letting sides work independently" reliably closed a felt
asymmetry, years of weighted pull-up training would be expected to have done it for
the lats already. The athlete reports felt asymmetry in the lats despite this. That is
not proof the mechanism is false — a felt impression is not a measurement, and the
pull-up and the OHP load different tissue in different positions — but it is a cheap,
directly relevant piece of this athlete's own history that argues against assuming
"go unilateral" is sufficient, and for treating the 4-week ultrasound finding above as
a weak, single-exercise hint rather than a general rule.

**Conclusion on Q1:** independent-arm pressing has a real, if unproven, mechanism for
a *strength*-expression asymmetry. For the *size* asymmetry the athlete is actually
describing, the mechanism requires three unverified premises to hold at once, the one
supporting data point is small and near-noise, and the athlete's own pull-up history is
a data point against expecting it to work. **Unilateral loading more plausibly lets an
existing pattern continue to express itself in reps or load, the same way it already
does on the weighted pull-up, than it corrects anything** — which is the athlete's own
hypothesis in the task brief, and the evidence here does not contradict it.

### Q2 — Minimum-disruption vehicle: does the existing T2 slot already answer this?

**Yes.** `pressing-asymmetry.md` §5 already flagged this: "swap only Wednesday's
volume-day OHP... since its history is separate, so the Sunday reference is untouched."
Re-examined against the stronger ask in this task (motivated by appearance, not a
replicated deficit) changes nothing about the mechanics:

- Wednesday's OHP is `double_progression`, 3×6-8, and its history is scoped by
  `dayKey` (`makeHistoryLookup()`, CLAUDE.md) — it does not feed `blockReference()`.
  Substituting it is a reversible, low-stakes change exactly like any other accessory
  swap already in this program (the Pull-day pulldown→pullover change, `coach/
  DECISIONS.md`, 2026-09-30).
- It already delivers **weekly, direct, equal-sets-per-side independent pressing
  volume** (3 sets per arm once bilateral sets become per-side, per the prior file's
  §5 point 4: "substitute, don't add" — 3 bilateral sets become 3 per-side sets, so
  the fractional dose for front delt and triceps is unchanged).
- It costs one exercise's worth of cold-start history (an accessory-tier lift with no
  monotone reference to protect), not a named strength goal's multi-week reference.

**A full T1 replacement does not add any capability this doesn't already have.** Both
give him "a side press each week where neither arm can lean on the other." The T1
version additionally removes the heavy bilateral probe — the one thing a dumbbell
variant cannot replicate (Kassiano 2025: bilateral strength follows bilateral
practice) — for no proportionate gain. **A full T1 swap is unnecessary; the T2
substitution already recommended is sufficient and should be the ceiling of what's
tried, not a stepping stone to something larger.**

### Q3 — If full replacement is not warranted, what instead

**It is not warranted**, for the reasons above: the premise is unmeasured, the
mechanism for the thing actually being described (size, not strength) is weak, the
athlete's own pull-up history argues against expecting it to work, and the cheaper
vehicle already does the job mechanically. What I would do instead:

1. **Change nothing on Sunday.** Barbell OHP stays as the T1 heavy lift, full stop.
2. **Run the assessment that was already designed and not yet done**
   (`pressing-asymmetry.md` §2a–2c: re-film with a protocol, the two-day single-arm
   seated DB test, wall-flexion check) before changing anything structural. This
   athlete has asked for a programme change on the strength of a feeling; the
   cheapest thing that would make the decision evidence-based rather than aesthetic
   is the thing that costs forty minutes and was already written up.
3. **If (and only if) a deficit replicates on two separate days**, substitute
   Wednesday's barbell OHP with seated single-arm dumbbell press, weaker side's reps
   logged, stronger side matched (prior file §5, point 5). This is the version of
   "both sides work independently" he is actually asking for, already in the plan,
   already costed, already reversible.
4. **If he wants to start now, without waiting for the formal assessment**, the
   single lowest-cost way to get the outcome he wants today is to treat the Wednesday
   substitution itself as the data-gathering step: run single-arm DB press on the
   volume day for 2–3 sessions, log reps per side. That gives him real unilateral
   stimulus immediately (addressing the felt need) while generating exactly the
   two-session comparison the assessment protocol calls for, at zero extra cost
   beyond what swapping the volume day already costs.
5. **The already-approved cost-free step stands too:** on single-arm accessories that
   exist regardless (cable lateral raise), pick the load for the weaker-feeling side,
   match reps on both, start with the side he likes less (prior file §Recs, point 8).

This gets him working-independently pressing stimulus, a real (if imperfect) read on
whether a deficit exists, and leaves the tracked strength goal and its multi-week
reference completely undisturbed.

### Q4 — If some version of the full swap is ever warranted, "for a while" defined

Answered conditionally, because I do not think the condition should be met, but the
question asked for a concrete answer if it is:

**Trigger to even consider it:** a replicated strength/control deficit from
`pressing-asymmetry.md` §2 that does **not** resolve after one full 4-week block of
the Wednesday-only substitution (§Q3.3 above), re-tested at that block's end. Only
then is "the T2 dose wasn't enough" a defensible reason to consider touching T1 —
and even then, the Kassiano 2025 specificity argument (bilateral strength needs
bilateral practice) means the honest trade is giving up measured OHP progress for an
unmeasured hypothesis, which should be stated to the athlete explicitly before doing it.

**Duration, if attempted:** no trial informs this number for this specific swap. Use
the same gates the prior file set for the T2 substitution: re-check at one 4-week
block, a hard outer limit of 8–10 weeks (two blocks), matching the time course in the
one hypertrophy study available (pec thickness change visible at 4 weeks) and the
general principle that an intervention which hasn't moved anything by 8–10 weeks
probably isn't working (prior file §4a).

**Re-entry test, concretely:** treat the return to barbell OHP exactly like the v3
entry sequence already built for a different purpose (SYNTHESIS §4.4) — a cold
**probe week**, not an assumption that the last known reference still applies. One
session at 1×3-5 @ RPE 8 establishes a fresh number; do not backfill or estimate a
reference from DB-press history, because no conversion between the two lifts'
loading is validated (see the transfer evidence below — DB and barbell shoulder
presses do not share a fixed ratio in trained lifters the way, say, a percentage-of-
1RM table assumes).

**What "resolved" looks like — an operational definition, not a feeling:** the
two-day single-arm seated DB test (prior file §2b) shows the rep gap at or under the
noise floor (same side does not lose by ≥ 2 reps on both of two separate days), **or**
a properly captured bar-tilt film (prior file §2a, `movement-asymmetry-metrics.md`
capture protocol) shows no reproducible tilt across two sessions. "I feel more even"
is not the criterion, for the same reason it was not sufficient to establish the
problem in the first place.

**Does a cold return need a deliberate re-ramp? Yes, with moderate confidence, for
two independent reasons:**

1. **No transfer data exists for this specific swap-back**, so the engine-mechanics
   answer (cold-start, full probe/back-off re-establishment) is also the honest
   evidence-based answer — there is nothing to shortcut it with.
2. **The task-specificity literature says some of what's gained on a dumbbell press
   is dumbbell-specific and does not fully transfer to a stable-bar pattern.**
   Saeterbakken et al. 2016 (10-week RCT, n = 36 resistance-trained men, 4.7 ± 3.8 y
   training; chest press on Swiss ball, Smith machine, or dumbbells, 2×/week) found
   the unstable/dumbbell-trained groups showed **task specificity** — gains were
   larger on the trained (unstable) variant than on the others — appearing within
   the first 7 sessions and persisting through 10 weeks; the stable Smith-machine
   group's gains transferred more broadly. **Search-summary only, primary paywalled
   — moderate confidence**, trained population, chest press not OHP, directionally
   relevant (dumbbell OHP is the less-stable variant of the pair under discussion).
   A 2025 *Sports Medicine* systematic review + meta-analysis of task specificity
   across dynamic resistance training (Saeterbakken et al., PMC12296774 — abstract/
   search-summary only, fetch blocked) reports task-specific strength gains roughly
   **twice the size** of the gains that transfer to a non-trained variant (dynamic
   SMD ≈ 0.98 vs transfer SMD ≈ 0.42) — a general finding across the reviewed
   literature, not this lift pair specifically, but consistent in direction: **some
   of the strength built on one variant of a press does not show up automatically on
   another variant.** Confidence **moderate** — meta-analytic, but the specific
   OHP/DB-OHP pair was not in it, and training-experience subgroups were examined by
   the review without the direction being reported to me in what I could access.
3. **Standing barbell OHP and standing DB shoulder press are not close substitutes
   even acutely.** Saeterbakken & Fimland 2013 (n = 15, ~5 years training;
   search-summary only, PubMed cookie-walled) found standing DB 1RM ≈ 7% below
   standing barbell and ≈ 10% below seated DB, while anterior-deltoid EMG was ~15%
   **higher** on standing DB than standing barbell — i.e., the DB variant asks for
   more stabilising muscle activity to move less absolute load, the classic
   stability/strength-expression trade-off. **Low-moderate confidence** (n = 15,
   search-summary only), but it independently supports treating a return to barbell
   OHP as a different skill, not a resumption, after any meaningful block on DB
   press.

**Net on Q4:** if attempted, "for a while" means one 4-week block, hard-capped at two,
gated by the operational re-test above (not a feeling), and the return is a full cold
probe exactly as the engine already treats any lift with no history — budget at least
one block (3 probe weeks + a test week) before the barbell reference is trusted again.
That is a real, non-trivial cost against a goal (BRIEF §1 priority 1) for a benefit
that the evidence above gives no more than a low-moderate chance of actually existing.

### Q5 — Throwaway: alternate DB press into the T2 slot instead of substituting outright

**Rule out.** Alternating (barbell one week, DB the next) on the volume day gives half
the unilateral dose of a straight substitution, for an intervention that has no dose-
response data to begin with — diluting an already-unproven effect further has no
stated upside. It also doubles the engine cost rather than halving it: two exercise
ids now each accumulate history at half the rate on the same slot, so *both* the
barbell volume-day progression and the DB volume-day "progression" become noisier and
slower to establish, instead of one clean substitution with one continuous history.
If the T2 swap is done at all, do it every week for the trial period, not in
alternation.

## Recommendations for this athlete

1. **No change to Sunday's barbell OHP.** It stays the T1 heavy lift, `probe_backoff`,
   feeding the monotone block reference, untouched.
2. **Do not replace it with dumbbell shoulder press "for a while."** The premise is
   unmeasured, the mechanism for the size concern he's actually describing is weak,
   and his own weighted-pull-up history is a reason to expect it not to work, not a
   reason to expect it will.
3. **If he wants independent-arm pressing now:** substitute single-arm (seated,
   back-supported) dumbbell press on Wednesday's volume day, 3×6-8 per side, weaker
   side's reps logged and the stronger side matched to it — exactly the
   already-written `pressing-asymmetry.md` §5 recommendation, unchanged by this
   stronger ask. Run it for 2–3 sessions and use the per-side rep log as the cheapest
   available data point while deciding whether to go further.
4. **Run the forty-minute assessment** (`pressing-asymmetry.md` §2a–2c) before
   treating this as settled either way. It is still the cheapest thing that would
   convert "I feel asymmetrical" into an actual answer.
5. **Only escalate to a full T1 swap if** a deficit replicates on two separate days
   **and** one full 4-week block of the T2 substitution does not resolve it **and**
   he accepts, explicitly, that it costs the Sunday reference entirely for that
   period and a full cold-probe re-entry afterward (budget a full block to trust the
   barbell number again).

## Conflicts, uncertainties and open questions

- **Nothing here was tested in this specific lift pair** (standing barbell OHP vs
  standing/seated DB press) in a substitution-and-return design. Every transfer and
  specificity number above is extrapolated from chest press, squat, or generic
  reviews — directionally relevant, not a direct measurement.
- **The task-specificity meta-analysis's training-experience subgroup direction**
  was reported to me only as "examined," not as a specific magnitude or direction —
  I could not open the primary source to check whether more experience means more or
  less specificity (i.e., whether a 10-year lifter transfers better or worse between
  variants than a 2-year one). This is the single biggest unresolved question behind
  the duration/re-entry numbers in Q4, and it should be flagged to a reviewer as
  unverified rather than assumed either way.
- **Would change this recommendation:** a validated measurement (proper bar-tilt
  film per `movement-asymmetry-metrics.md`'s protocol, or a replicated two-day
  single-arm gap) showing a real, load-dependent deficit — that still routes to the
  T2 substitution first, not straight to T1, but it would justify doing something now
  rather than waiting. Pain or any red flag from `pressing-asymmetry.md` §7 overrides
  everything here regardless.
- **Not covered here:** broader unilateral restructuring across the program and
  dead/active hangs — explicitly routed to `hypertrophy-coach` per this task's
  instructions; whether leg-day unilateral work is relevant (it isn't, for a pressing
  question); anything about the running side of the program.

## Sources

**Opened as full page**
- Mang, Kravitz, Beam 2022, "Transfer Between Lifts: Increased Strength in Untrained
  Exercises," *Strength and Conditioning Journal* 44(3):101-106 —
  https://www.nsca.com/contentassets/3c0357cb66b54c6b9a598b0ca578600a/scj-transfer-between-lifts-2022.pdf
- This project: `research/pressing-asymmetry.md`, `research/movement-asymmetry-metrics.md`,
  `research/physique-metrics.md`, `research/BRIEF.md`, `research/SYNTHESIS.md` §1.1,
  §1.6, §4.4, `coach/DECISIONS.md`, `src/core/progression.js` (as described in
  CLAUDE.md; not modified)

**Search-summary only, primary not opened**
- Saeterbakken & Fimland 2013, Effects of body position and loading modality on
  muscle activity and strength in shoulder presses — https://pubmed.ncbi.nlm.nih.gov/23096062/
- Saeterbakken et al. 2016, Resistance-training exercises with different stability
  requirements: time-course of task specificity (chest press, Swiss ball / Smith
  machine / dumbbell) — https://pubmed.ncbi.nlm.nih.gov/27671996 ,
  https://link.springer.com/article/10.1007/s00421-016-3470-3 (paywalled)
- Saeterbakken et al. 2025, Task Specificity of Dynamic Resistance Training and Its
  Transferability to Non-trained Isometric Muscle Strength: A Systematic Review with
  Meta-analysis, *Sports Medicine* — https://link.springer.com/article/10.1007/s40279-025-02225-2 ,
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12296774/ (fetch redirected, not re-tried)
- Smoak et al. 2023, Randomized Trial Comparing Barbell and Dumbbell Bench Press on
  Maximal Strength and Power Output — already in `pressing-asymmetry.md` sources,
  reused here for the barbell/dumbbell transfer context
- The short- and long-term effects of resistance training with different stability
  requirements (squat: free weight / Smith machine / wobble board), PLOS ONE —
  https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0214302 (same
  research group, squat not press; cited only for the general stability-specificity
  pattern, not relied upon for a number)

**Carried over, not re-opened this session** (see `pressing-asymmetry.md` for full
citations): Kassiano et al. 2025 (unilateral vs bilateral meta-analysis); Wong et al.
2024 (cross-education meta-analysis); Foley et al. 2025 (limb asymmetry meta-analysis);
the Frontiers 2025 symmetric-load EMG study; the offset-loading bench press ultrasound
study; Saeterbakken et al. 2020 (offset-loading EMG).
