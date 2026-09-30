# Audit — may a test-week probe lower the next block's reference?

**Scope.** One rule: the test-week seeding branch of `blockReference()`
(`src/core/progression.js` ~232–260), read against SYNTHESIS §1.1, §1.4, §5.1,
§5.3 and BRIEF.md. Nothing else in v3 is reviewed. No code was modified.

**Method note.** I had no shell in this session, so every number below is derived
analytically from the app's own formulae (`e1rm`, `loadForReps`,
`loadFromReference`, `roundToIncrement`) by reading the source. The two claims
that most deserve execution before acting are marked **[verify by running]**.

---

## Verdict

**MAJOR — change required, and the §1.1 sentence is a BLOCKER on the spec side.**

The spec is genuinely ambiguous: §1.1's test clause is the only clause in the
section with no stated direction. But it is ambiguous in a section whose other
four clauses all say "upward", "changes nothing" or "never touch", and
`blockReference()` is monotone non-decreasing on **every path except this one**.
The code is not implementing a decision; it is resolving an under-specified
sentence in the one direction the rest of §1.1 rules out. On the merits the
downward move is also wrong: the drop it acts on (~2.8% in the worked example)
is inside the measurement error of the instrument, and it is measured at peak
accumulated fatigue and then applied *after* the deload that exists to remove
that fatigue. Fix before the next test week is logged — under a 4-week block
that is week 3 of the current block.

Severity is MAJOR rather than BLOCKER only because of an accident: an unrelated
guard in `prescribe.js` absorbs small downward moves on incline and OHP. That
guard was written for a different purpose, does not cover pull-ups, and does not
protect the reference itself — so the hazard is latent, not absent.

---

## The rule statement I recommend

Two rules. **R1 is the fix** and is implementable and unit-testable today. **R2
closes the hole R1 opens** and is contingent on §5.3 being built (it is still
manual, per SYNTHESIS §5.3 and Part 7).

### R1 — the test seed is monotone (replaces the current branch)

> **A pending test-week seed replaces the block reference only if it exceeds it.**
> When the deload row following a `role: 'test'` row is folded in:
> if the reference is null, or the test probe's e1RM is strictly greater than the
> current reference, the reference becomes the test e1RM, `source` becomes
> `'test'`, `date` becomes the test date, and `stalls` resets to 0. Otherwise the
> reference, `source`, `date` and `stalls` are all left untouched, and the pending
> seed is discarded. A test probe never lowers the reference and never resets the
> stall counter.

Unit tests this pins:
1. Test e1RM **above** the reference → next block's reference = test e1RM,
   `source === 'test'`, `stalls === 0`. *(The existing test at
   `tests/unit/reference.test.mjs:63` already asserts this and must stay green.)*
2. Test e1RM **below** the reference → reference unchanged, `source` unchanged
   (still `'probe'`/`'backoffs'`), `date` unchanged.
3. Test e1RM below the reference → `stalls` keeps accumulating across the deload
   (currently it is zeroed unconditionally; see Finding 4).
4. Test e1RM **equal** to the reference (within 1e-9) → unchanged, `stalls` not
   reset. Ties are not evidence.
5. Rounding case: a test set performed at exactly the prescribed load, reps and
   RPE never lowers the reference (Finding 2).

### R2 — the sanctioned way down: deload first, then confirm

> **The reference drops only on a regression confirmed after a deload.** If two
> consecutive non-deload heavy sessions for a lift each show a probe e1RM ≥ 3%
> below the reference *they were lifted against* (this is exactly §5.3 condition
> (a), and is what `tools/review.mjs:270–277` already computes), a deload is
> prescribed. If the **first non-deload probe after that deload** is still ≥ 3%
> below the reference, the reference is reset to that probe's e1RM, `source`
> becomes `'reset'`, and the lift rebuilds with `afterMisses.increment`
> (1.25 kg). The reference may not reset twice inside one block.

Why this shape: it uses only data the engine already carries (`role`,
`isDeload`, probe e1RM); it never responds to one datum twice (the deload is the
first response, the reset is the second only if the first failed); it measures
capacity *after* the recovery week rather than before it; and it resets to a
**measured** value rather than the flat 5% of §1.4 step 4 — which is the right
instrument for a stall (where the purpose is resetting RPE calibration and
strain) but the wrong one for detraining, where the loss is not a calibration
problem and can be far more or far less than 5%.

**Interim, until §5.3 is built:** ship R1 alone, plus a *prompt* rather than a
load change. When a test probe comes in ≥ 3% below the reference, surface it
("test came in 3.4% under reference — reference held; if the first probe of the
new block is also under, apply the §1.4 reset"). The review tool already has
every number this needs.

**Spec change §1.1 needs regardless of which way this goes.** Replace "sets the
*next* block's reference" with an explicit direction. For R1:
> The test week's RPE-9 set (§5.1) **raises** the *next* block's reference if it
> beats the current one; it never lowers it, and it does not raise working loads
> in the block it was lifted in. The reference moves down only by the confirmed
> regression rule (§5.3 / §1.4).

---

## Findings

### 1. [MAJOR] A downward seed is the *modal* outcome of a correctly executed test week, not an edge case

`prescribe.js:152` prefills the test probe from the reference itself:
`loadForReps(ref, 3, 9)` = `round(ref / 1.1333)`. So the test is "confirm the
reference at RPE 9", and by the app's own formula
∂e1RM/∂RPE = load/30 ≈ **2.9% of e1RM per RPE point** at 3 reps — the same
2.9% per missed rep. For a 96 kg incline reference the prescribed set is
85 × 3 @ RPE 9. The plausible outcomes:

| What he logs | Seed | vs 96.0 |
|---|---|---|
| 3 reps, rated 9 | 96.3 | level |
| 3 reps, rated 9.5 | 94.9 | **−1.1%** |
| 3 reps, rated 10 (pushed it, rated honestly) | 93.5 | **−2.6%** |
| 2 reps, rated 9 | 93.5 | **−2.6%** |
| 4 reps, rated 9 | 99.2 | +3.3% |

Three of the five likeliest outcomes lower the next block, and the two most
likely at the end of three loading weeks — "three reps but it felt like a 10",
and "one rep short" — both lower it. **The rule penalises trying hard and
rating honestly.** An athlete who habitually rounds his RPE down is rewarded
with heavier loads; that is the wrong incentive to build into an autoregulated
program.

*Problem class:* unsupported decision + perverse incentive.
*Resolution:* R1.

### 2. [MAJOR] Plate rounding alone can seed the reference down after a perfect test

Seed < reference ⟺ `round(ref/1.1333)` rounded **down**, which happens for
roughly half of all reference values. Worst case is `increment/2 × 1.1333`:
**up to 1.42 kg (~1.5%) on incline**, 0.71 kg (~0.9%) on OHP, 0.71 kg (~0.6%)
on the pull-up. Concrete: reference 94.0 → prescribed 82.5 × 3 @ 9 → he hits it
exactly at exactly the target RPE → seed 93.5, a 0.53% drop for a **completed,
successful test**.

That is a pure artifact with no physiological content, and ~1.5% on incline is
more than half of one 2.5 kg increment (2.6% of a 96 kg reference) — i.e. more
than half a block's expected progress for an athlete whose realistic rate is
~12 kg/year per lift (Latella 2020, n = 1,897 competitive powerlifters, T1-adjacent;
`strength.md:84`). **This is the proof that the current behaviour is unintended
rather than a design choice** — nobody designs a test that a success can fail.
R1 removes it for free.

*Problem class:* implementation defect revealed by the spec gap.

### 3. [MAJOR] The measurement is taken before the treatment and applied after it

SYNTHESIS §5.1 puts the test in the last loading week of the block and the
deload immediately after it, and the seed is applied *on the deload row*
(`progression.js:235–244`). So in the build block the sequence is always:
measure at peak accumulated fatigue → deload → open the next block at the
fatigued measurement. The deload's own probe is RPE 6 and cannot update anything
(`if (row.isDeload) … continue`), so **no fresh reading is ever taken between
the low measurement and the loads it sets.**

This answers the question in the brief about redundancy with §5.3 directly, and
the answer is "yes, it is a double response, in the build": a low test already
receives a deload, because the deload is unconditionally scheduled. Lowering the
reference is a *second* response to the same datum, applied after the
intervention that was supposed to fix what the datum measured.

Recovery afterwards is unreliable. The new block's week-1 probe is prescribed
from the lowered reference (`loadForReps(93.33, 4, 8)` → 77.5 kg vs 80 kg from
96.0), and the raise condition is `e > ref` strictly — so hitting exactly the
prescribed 4 @ RPE 8 on the lighter bar yields 93.0 < 93.33 and **no** raise.
The probe is a measuring instrument whose calibration is set by the value it is
measuring: a lowered reference lowers the probe, which confirms the lowered
reference. The athlete can break the loop only by adding load beyond what the
app prescribed. That is not a self-correcting system.

*Problem class:* logical defect / unsupported decision.

### 4. [MAJOR] A downward seed blinds both regression detectors the program relies on

Two separate mechanisms are degraded, and the shipped code already documents
both as problems:

**(a) §5.3 condition (a) is desensitised.** The trigger is "heavy-day e1RM ≥ 3%
below the block reference two heavy sessions running". If the reference chases
performance downward, subsequent weak probes are no longer 3% below it and the
trigger never fires. The detector's threshold moves with the thing it measures.
`tools/review.mjs:270–277` had to pin the comparison to the reference each
session "was lifted **against**" to avoid a related artifact.

**(b) The §1.4 stall clock is reset unconditionally.** `stalls = 0` runs on the
deload row whenever a pending seed is applied, whatever its direction
(`progression.js:241`) — and `stalls` is what switches incline from the 2.5 kg
to the 1.25 kg step (`afterMisses: { count: 2 }`). The review tool abandoned
`blockReference().stalls` for exactly this reason; its comment at
`tools/review.mjs:238–242` reads: *"it resets on the deload that follows a test
probe whether or not the reference moved, so a genuine two-block stall was
unreachable."* A second workaround, at `tools/review.mjs:192–195`, exists purely
to stop the downward move being double-counted as progress on the way back:
*"which can move the reference DOWN on the deload row — so the next session's
return to the old number read as progress that was never made."*

Two independent workarounds in the review tool are the strongest available
evidence that the current semantics are not usable downstream. The app's Today
screen has no equivalent workaround.

*Problem class:* contradiction between §1.1 as implemented and §5.3 / §1.4.
*Resolution:* R1 fixes (a) by leaving the reference alone; the `stalls` clause of
R1 fixes (b).

### 5. [MINOR — correction to the brief's worked example] The 77.5 → 75 kg drop probably does not happen on incline

**[verify by running]** By my reading, the guard at `prescribe.js:158–167` fires
in the brief's example and holds the bar at 77.5 kg:

```
backoffWeight       = loadFromReference(93.33, 0.8, incline) = round(74.67/2.5)*2.5 = 75.0
ref.lastBackoffLoad = 77.5   (the test week's own back-offs, 80% of 96.0)
ref.source          = 'test'                    → passes `!== 'backoffs'`
incline.loadModel   = 'external'                → passes
77.5 > 75.0                                     → passes
77.5 − 75.0 = 2.5 <= ex.increment (2.5)         → passes  ⇒ backoffWeight = 77.5
```

So the back-off bar is held, and the reported "back-offs 75 kg" would require
either the test-week back-offs to have been logged below 77.5 or a drop larger
than one bar increment. This matters three ways, and none of them weakens the
finding:

- The guard only absorbs reference drops up to `increment / pct`: **3.125 kg
  (~3.3%) on incline, 1.56 kg (~2.1%) on OHP**. Anything larger — a test set two
  reps short, an RPE 10 rating on a lighter self-selected load — passes through
  and drops the bar.
- **Pull-ups are explicitly exempt** (`ex.loadModel !== 'bodyweight_plus'`), so
  any downward seed moves the belt immediately on the one lift where the
  reference is on system mass.
- The guard protects the *bar*, not the *reference*. Every harm in Findings 1, 3
  and 4 — the probe feedback loop, the desensitised §5.3 trigger, the reset stall
  clock, the number shown on the exercise screen and in the coach report — passes
  through untouched.

A latent hazard held off by a line written for an unrelated purpose (a finer
increment rounding the same reference lower) is a reason to fix the root cause,
not a reason to leave it. If that guard is ever tightened, this becomes a live
load drop with no test covering it.

### 6. [MINOR] A skipped deload silently discards the test measurement entirely

`pendingSeed` is applied only when an `isDeload` row is encountered, and the
history index only contains **completed** sessions (`store.js:71`). Skip the one
deload heavy session for that `dayKey` and the test probe is discarded — in
either direction, including a good test that should have raised the reference.
Worth one assertion whichever way the direction question is decided.

### 7. [MINOR — omission] There is no other downward path in the engine at all

I grepped `src/` for a reference override, reset or layoff rule: **there is
none.** §1.4 step 4 ("reset the reference by 5% and rebuild in 1.25 kg steps")
exists only as advisory prose emitted by the review tool
(`tools/review.mjs:265`); nothing applies it. The "gap ≥ 10 days → re-enter one
rung down" rule in SYNTHESIS §8 is the **running** ladder, not the lifting
reference. So the test seed is, today, the only way the reference can ever fall.

This is the honest cost of R1 and the reason R2 is not optional: after illness,
travel, or a long interruption the reference would sit at a value he can no
longer hit, week-1 back-offs would come in too heavy, the back-off double
progression would never fire, and the only signal would be a stall flag two
blocks later. Note that "too heavy" is the *benign* failure (Finding 8), so this
is a gap to close deliberately rather than an argument for keeping the current
behaviour.

### 8. [Reasoning that decides it] The losses are asymmetric, so the estimator should be biased upward

- A reference ~3% **too high** costs one under-performed session: he gets 4–5
  reps instead of 6 at ≤ RPE 8.5, the double progression does not fire, the stall
  counter ticks. That is the engine's *designed* response to being too heavy, and
  it is visible to him.
- A reference ~3% **too low** costs a whole block of back-offs he cannot detect
  as sub-threshold. This is precisely the v2 failure mode that the previous
  reviewer called a BLOCKER (`research/REVIEW.md:15–17`) and that §1.1 exists to
  fix: v2's back-offs landed at ~66–74% 1RM / RPE 4–7, sub-threshold for a
  resistance-trained lifter (Androulakis-Korakakis 2020, T1 meta-analysis in
  resistance-trained men; `strength.md:76`).
- BRIEF.md: *"the cost of a wasted mesocycle is months, not weeks."*

Under asymmetric loss, an estimator at the edge of its noise floor should be
biased toward the cheaper error. That is the upward direction. **This is
reasoning, not evidence** — no study compares the two policies.

---

## Answers to the four questions in the brief

**1. Is a single RPE-9 triple at the end of a loading block a trustworthy
downward measurement? No — the signal is inside the noise.** Stacking the three
available error sources, all converted through the app's own formula
(2.9% of e1RM per RPE point and per rep at 3 reps):

| Source | Population | Number | As e1RM error |
|---|---|---|---|
| Load-selection error to a target RPE — Helms 2017, JSCR, n = 12 powerlifters, T2 validation (`strength.md:47`) | competitive powerlifters — the closest match available | 0.33 ± 0.28 RPE mean absolute error | ~1.0%, SD ~0.8% |
| Intraset RIR prediction error — Remmert/Zourdos 2023, *Percept Mot Skills*, n = 24 resistance-trained, bench @ 75% 1RM | resistance-trained | 0.65 ± 0.78 reps | ~1.9%, SD ~2.3% |
| Test–retest of a **directly measured, rested, standardised** 1RM bench — JSCR 2008 chain-loaded bench reliability work, resistance-trained men | resistance-trained | ICC 0.945–0.993, CV 1.25–3.33% | 1.3–3.3% |

The instrument's floor is therefore ~1–3% **under rested, standardised
conditions with a real 1RM attempt**. The app's instrument is strictly worse
than that floor: one submaximal triple, converted through a subjective RIR
estimate, at the peak accumulated fatigue of a three-week loading block. The
worked example's signal is **2.8%**. It does not clear the noise.

Two honest counterweights. (i) Helms 2017's own finding is that RPE accuracy is
*better closer to failure*, so the RPE-9 test set is the best-rated set in the
block — that cuts **for** trusting it, and it is why the protocol puts the test
there at all. My argument does not rest on the rating being bad; it rests on the
rating being good but the derived e1RM still carrying ~2% error, and on the
fatigue state. (ii) Carroll 2019 (n = 15 well-trained men, T2; `strength.md:67`)
shows daily relative maxes produce greater training strain and worse
RFD/jump outcomes than submaximal work — but that is about maxing as a *training
method*, not about the validity of one measurement, and SYNTHESIS §1.1 already
cites it correctly for the former. I am not stretching it to the latter.

**The decisive question — does a pre-deload near-max estimate predict
post-deload capacity? — is unanswered.** Nothing in the four research files
addresses it and I found nothing in searching. Anyone who says otherwise is
guessing. **This is a judgement call, and I am making it on asymmetric loss
(Finding 8), not on evidence.**

Also relevant: Robinson 2024 (T1, 67 strength studies; `strength.md:69`) is why
§5.1 calls the test week "a *test*, not extra stimulus". The test week costs
fatigue and buys no stimulus; its entire justification is the measurement. If
the measurement is not trustworthy downward, the case for letting it act
downward is zero, not small.

**2. Redundancy with §5.3? Worse than redundancy, in both directions.** In the
build the test is always followed by a scheduled deload, so a low test already
gets the deload and the load cut is a second response to one datum, applied
after the treatment (Finding 3). Post-10K, once §5.3 is built, the downward seed
*disables* condition (a) by moving the threshold with the measurement (Finding
4a). So: double response now, blind detector later.

**3. Is the asymmetry with the unplanned-hard-probe rule coherent? No.** §1.1
protects the dose against an unplanned RPE ≥ 9 probe ("changes nothing"), and
the code honours it: for non-test rows the reference only moves on `rpe <= 8 &&
e > ref` or on a completed back-off progression. Both are strictly upward.
Deloads "never touch" it. The test clause is the only one in §1.1 without a
direction and the only non-monotone path in the function. An unplanned hard
probe being ignored while a planned hard probe cuts the next block is
incoherent, and the incoherence is a strong signal that "sets" was written to
mean "is what seeds it", not "may lower it".

**4. Cost of the other choice, and is the 5% reset the path back down?** The
cost is real and larger than the brief assumes: R1 removes the engine's *only*
downward path, because §1.4 step 4 is unimplemented prose (Finding 7). On
whether 5% is too blunt — it is the right instrument for a **stall** (where its
mechanism is resetting RPE calibration and strain, and where it fires only after
a documented two-block stall and three prior interventions; `strength.md:82`
flags it as T5 practice with no trial evidence) and the wrong one for
**detraining**, where the loss is not a calibration problem and may be much
larger or much smaller than 5%. So no: the 5% reset does **not** make a downward
path unnecessary. It makes an *unconfirmed, fatigue-state* downward path
unnecessary. Hence R2, which re-seeds to a measured value after a deload.

---

## Tie-breaker, stated plainly

The spec sentence is ambiguous and, read in isolation, either behaviour is
defensible. The tie-breaker is not the sentence, it is three things that do not
depend on reading it:

1. Every other clause in §1.1, and every other path in `blockReference()`, is
   monotone upward or inert. Resolving the one silent clause against all four of
   its neighbours is the less likely reading of the author's intent.
2. A *successful* test can lower the reference through plate rounding alone
   (Finding 2). No coherent rule has that property.
3. The losses are asymmetric and the signal is inside the noise (Findings 1, 8).

Ship R1. Write R2 into §1.1 and §5.3 so the way down is deliberate, confirmed
and post-deload, and implement it when §5.3 is built. Until then, prompt rather
than change the load.

---

## Confidence audit for this audit

| Claim | Confidence | Why |
|---|---|---|
| 2.9% of e1RM per RPE point / per rep at 3 reps; rounding can drop a successful test by up to ~1.5% on incline | **high** | Arithmetic on the app's own formulae, read from source |
| A downward seed is a likely, not exceptional, test-week outcome | **high** | Follows from the probe being prefilled from the reference (`prescribe.js:152`) |
| The signal is inside the instrument's noise | **moderate** | Reliability numbers are from resistance-trained men and (for the 1RM CVs) from rested standardised tests, small n; nobody has measured a 10-year lifter. Remmert 2023 is cited **from its abstract via search only** — PubMed served a CAPTCHA and SAGE returned 403, so I could not open the full text. Treat 0.65 ± 0.78 reps as unverified at source. |
| Both §5.3 and §1.4 detectors are degraded | **high** | The workarounds are in the shipped review tool with comments saying so |
| The `prescribe.js` guard absorbs the brief's worked example | **moderate** | Read, not executed — **[verify by running]** |
| Bias the estimator upward because losses are asymmetric | this is **reasoning, not evidence** | No study compares the two policies; stated as judgement |
| R2's "deload then confirm" is the correct shape | **low–moderate** | Coherent with §5.3's own two-reading standard and with measuring after recovery, but untested by anyone. It is a design judgement. |

---

## What is right in the current design and must survive the fix

- **The test week existing at all, and not raising working loads in its own
  block.** That separation is well reasoned and correctly cited (Robinson 2024,
  Carroll 2019).
- **Applying the seed on the deload row rather than immediately.** The timing
  hook is right; only the direction is wrong. R1 is a three-line change inside
  the same branch.
- **Anchoring the back-off raise on the load actually lifted**
  (`progression.js:275–278`) rather than on the rounded reference. That is a
  genuinely subtle correctness fix and R1 does not touch it.
- **`source`, `date` and `stalls` being returned at all** — they are what makes a
  rule like R2 implementable without new state.
