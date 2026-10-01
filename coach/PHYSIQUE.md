# Weekly physique capture

> **Corrected 2026-10-01** from `research/physique-metrics.md`, which is the
> `physique-analyst` agent's methodology research, and from the first real
> capture. The headline change: the capture is now **full body with a reference
> beside you**, and the tape is **three reps tracked by median, reviewed at
> block boundaries, not weekly**. Where a number below is convention rather than
> measurement, it says so.

Nothing here goes in git: `coach/data/` and `coach/reports/` are gitignored and
this repo is public.

## The setup, once

Spend ten minutes on this once and every week afterwards is twenty seconds.

- **Get a reference into your own depth plane.** A plumb line hung immediately
  beside you, or stand against a door frame's vertical edge. **This is the most
  important item on the page**, and the first capture had nothing like it.
  Anything on the far wall — an AC unit, a door track — only proves the camera
  was square to the *wall*. It cannot tell you whether *you* were square to the
  camera, and within a single frame your rotation and an off-centre camera
  produce the identical false asymmetry.
- **Frame your whole body, feet included.** The first capture cropped at the
  waistband in all 28 frames, which meant quads, hamstrings and calves could not
  be assessed at all — while calves are one of only two tape sites. Full body,
  every week, so the video and the tape measure the same person.
- **Mark the floor.** Two pieces of tape for your feet. Same spot every week,
  and now actually in shot.
- **Mark the phone.** Tripod at a fixed height and distance, tape on the floor
  for that too, same orientation. Genuinely locked — not propped on something
  that can slide. The first clip's background drifted about 6% of frame width
  and 5% of frame height, which is not a tripod.
- **Same light, every week, and diffuse it.** Artificial light you control beats
  daylight. Never a window behind you. A single overhead or frontal source
  throws directional shadow across the shoulders that mimics a size difference —
  bounce it, or add a second source.
- **Plain background.** Lowest priority, but a patterned curtain makes your
  outline harder to read.
- **Same time of day**, same state: before training, not after. A pump is not
  growth — a transient ~1.5 cm girth increase after training has been reported.
  Morning before food is the most repeatable.
- **Fix the weekday**, and pick one at least 48h clear of directly training arms
  or calves. Muscle damage shifts fluid for 24–72h.

## The video — about twenty seconds

One clip. Four poses, roughly five seconds each, **held still**, in this order:

1. **Relaxed front** — arms at your sides, not flared, feet on the marks.
2. **Relaxed back** — same, facing away.
3. **Back lat spread** — **hands on hips, elbows pulled forward.** This is not a
   rear double-biceps, which is what the first capture actually recorded: fists
   up at shoulder height shows rear delts, traps and arms, not lat width. The
   two are easy to confuse and measure different muscles.
4. **Side** — same side every week. Pick left or right and write it down.

**Only these four.** A third of the first clip went on flared-arm variants, a
front double-biceps and an overhead stretch, and that time came straight out of
the side pose, which ended up with exactly one usable frame.

Breathe normally; do not hold your breath or brace.

Drop the clip in `coach/data/physique/` named by date (`2026-10-05.mov`), then:

```bash
node tools/physique.mjs coach/data/physique/2026-10-05.mov
```

That needs `brew install ffmpeg` once. It extracts a frame a second at the
resolution a vision read actually uses, writes a contact sheet with a
`contact.txt` legend, and leaves everything in `coach/data/physique/<date>/` —
dated from the clip itself, so an iPhone name like `IMG_3699.MOV` still lands in
the right folder.

## The tape — about three minutes

Arms and calves only. These are the sites where a tape is most reliable and
where a left/right difference is easiest to measure honestly; a tape around a
torso measures posture and breathing as much as muscle.

- **Upper arm, relaxed** — arm hanging at your side, tape at the midpoint
  between the tip of the shoulder and the point of the elbow. **Mark that point
  with a pen** so it is the same spot next week.
- **Upper arm, flexed** — same arm raised to horizontal, elbow at 90°, squeezed.
  Tape at the largest girth.
- **Calf** — standing, weight even on both feet, tape at the largest girth.

Both sides, every site. **Three measurements per site per side, removing and
reapplying the tape between each. Record all three and track the median.** Not
"twice, and a third if they disagree" — stopping as soon as two numbers agree
isn't precision, it's luck, and it gives you a different N every week.

Record in `coach/data/physique/measurements.md`:

```
## 2026-10-05
left arm relaxed   35.1 / 35.2 / 35.1
right arm relaxed  35.8 / 35.7 / 35.9
left arm flexed    38.4 / 38.5 / 38.4
right arm flexed   39.2 / 39.1 / 39.3
left calf          38.0 / 38.1 / 37.9
right calf         38.2 / 38.2 / 38.4
```

## What counts as a real change

**Take the tape weekly. Do not interpret it weekly.**

- **Week to week, nothing clears the noise.** The closest reliability study
  (n=46, examiner-measured, young non-athletes — so probably *optimistic* for
  self-measurement) puts minimal detectable change at **>0.6 cm upper limb** and
  **>1.3 cm lower limb**. Use **~1 cm arm / ~1.3–1.5 cm calf** as the working
  floor. At your training age a plausible week's growth is 1–2 mm. That is
  inside the noise, every time, no matter how carefully you measure.
- **So compare at block boundaries**, on the programme's existing 5-week
  mesocycle. The weekly number builds the trend line; the block boundary is
  where you read it.
- **For left vs right, your own spread is the instrument** — better than any
  borrowed threshold. Both sides are measured in the same sitting with the same
  tape and the same hands, so they share every error except landmark-finding and
  tension. **If the gap between the two sides' medians is no bigger than the
  spread across your own three reps on one side, there is no finding.**
- Treat the ~1 cm / ~1.3–1.5 cm figures as a **starting convention**, to be
  replaced by your own within-side spread once a few sessions exist.

## What happens with it

The `physique-analyst` agent reads the contact sheet, picks the squarest frames,
compares **left against right inside a single frame** (never this week's shot
against last week's — lighting, tan and pump cancel within one image and do not
cancel between two), cross-references the volume and progression numbers in the
latest `coach/reports/` review, and writes a dated audit to
`coach/reports/physique-<date>.md`.

**The methodology lives in `research/physique-metrics.md`, which is committed.
The audits live in `coach/reports/`, which is not.** Anything that quotes a
load, a bodyweight, an adherence figure or the contents of a frame stays on the
gitignored side — the repo is public.

Three things it will keep telling you, and all three are honest:

- **A frame shows width, not muscle.** Scapular position and thoracic rotation
  read exactly like a size difference. Expect "cannot tell from these frames" as
  a real answer, with what to change about the shot.
- **There is no validated way to call a muscle "lagging" from a photograph.**
  The research found no study testing the human eye against DXA, ultrasound or
  MRI for this. What a photo can honestly answer is "did something change enough
  to see" and "is there a gross, unmissable asymmetry" — not "which muscle is
  behind, by how much".
- **Arm and calf findings have a number behind them; lat findings do not.**
  There is no per-side set logging, so a torso asymmetry rests on the frames
  alone, and the report will say so rather than borrowing the tape's authority.
