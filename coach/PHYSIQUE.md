# Weekly physique capture

> **Provisional.** These numbers and landmarks are convention, not evidence. The
> `physique-analyst` agent's first job is to establish what is actually
> defensible and write `research/physique-metrics.md`; this file gets corrected
> from that. Start capturing now anyway — a consistent imperfect protocol beats a
> perfect one you begin in three weeks, because consistency is most of what
> makes week-to-week comparison mean anything.

Nothing here goes in git: `coach/data/` is gitignored and this repo is public.

## The setup, once

Spend ten minutes on this once and every week afterwards is twenty seconds.

- **Mark the floor.** Two pieces of tape for your feet. Same spot every week.
- **Mark the phone.** Tripod at a fixed height (hip height is fine) and a fixed
  distance (tape on the floor for that too). Phone in the same orientation.
- **Same light, every week.** Artificial light you control beats daylight, which
  changes with the season and the weather. Never a window behind you.
- **Plain wall**, and get a **vertical in the shot** — a door frame, the corner
  of a wall, a hanging plumb line. This is not decoration: it is the only way
  anyone can tell whether you were square to the camera, and rotation is the
  single biggest thing that makes one side look bigger than the other.
- **Same time of day**, same state: before training, not after. A pump is not
  growth. Similar hydration; morning before food is the most repeatable.

## The video — about twenty seconds

One clip. Four poses, roughly five seconds each, **in this order**:

1. **Relaxed front** — arms at your sides, not flared, feet on the marks.
2. **Relaxed back** — same, facing away.
3. **Back lat spread** — the one that shows the lats, and the easiest to perform
   asymmetrically. Hold it the same way every week or it measures your posing,
   not your back.
4. **Side** — same side every week. Pick left or right and write it down.

Hold each still. Breathe normally; do not hold your breath or brace.

Drop the clip in `coach/data/physique/` named by date (`2026-10-05.mov`), then:

```bash
node tools/physique.mjs coach/data/physique/2026-10-05.mov
```

That needs `brew install ffmpeg` once. It extracts a frame a second, writes a
contact sheet with a `contact.txt` legend, and leaves everything in
`coach/data/physique/<date>/` — dated from the clip itself, so an iPhone name
like `IMG_3699.MOV` still lands in the right folder.

## The tape — about two minutes

Arms and calves only. These are the sites where a tape is most reliable and
where a left/right difference is easiest to measure honestly; a tape around a
torso measures posture and breathing as much as muscle.

- **Upper arm, relaxed** — arm hanging at your side, tape at the midpoint
  between the tip of the shoulder and the point of the elbow. **Mark that point
  with a pen** so it is the same spot next week.
- **Upper arm, flexed** — same arm raised to horizontal, elbow at 90°, squeezed.
  Tape at the largest girth.
- **Calf** — standing, weight even on both feet, tape at the largest girth.

Both sides, every site. **Measure twice and write down both** — if the two
disagree by more than a couple of millimetres, measure a third time; that spread
is your measurement error, and a weekly change smaller than it means nothing.

Record in `coach/data/physique/measurements.md`:

```
## 2026-10-05
left arm relaxed   35.1 / 35.2
right arm relaxed  35.8 / 35.7
left arm flexed    38.4 / 38.5
right arm flexed   39.2 / 39.1
left calf          38.0 / 38.1
right calf         38.2 / 38.2
```

## What happens with it

The `physique-analyst` agent reads the contact sheet, picks the squarest frames,
compares **left against right inside a single frame** (never this week's shot
against last week's — lighting, tan and pump cancel within one image and do not
cancel between two), cross-references the volume and progression numbers in the
latest `coach/reports/` review, and writes a brief for the specialists.

Two things it will keep telling you, and both are honest:

- **A frame shows width, not muscle.** Scapular position and thoracic rotation
  read exactly like a size difference. Expect "cannot tell from these frames" as
  a real answer, with what to change about the shot.
- **Arm and calf findings have a number behind them; lat findings do not.**
  There is no per-side set logging, so a torso asymmetry rests on the frames
  alone, and the report will say so rather than borrowing the tape's authority.
