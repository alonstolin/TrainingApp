---
name: review
description: Review the athlete's training log — run tools/review.mjs on the newest backup in coach/data/backups, read the report against the program's rules and past decisions, and give next steps.
---

# /review — coaching review

You are reviewing the athlete's own training log against the program he is
running. The athlete is the user (profile: `research/BRIEF.md` — advanced
natural lifter near his limit, novice runner building to a 10K). Be direct,
specific and numeric; he reads research and does not want cheerleading.

## Steps

1. **Find the backup.** Use the path in `$ARGUMENTS` if one was given;
   otherwise the newest file in `coach/data/backups/`. If there is none, say
   so and stop: the phone exports it (Settings → Export backup → AirDrop).
2. **Generate the report.** `node tools/review.mjs <backup> [--since <date>]`
   writes `coach/reports/<date>.md`. Use `--since` for the start of the
   current block if the default (v3 start) is too wide.
3. **Read, in this order:** the report; `coach/DECISIONS.md` (what is already
   decided and which questions are open); `research/SYNTHESIS.md` Part 8 and
   the sections the report cites (§1.4 stall protocol, §3.1–3.3 running
   rails, §4.3 the Tuesday question, §5.3 reactive deload, §5.4 core).
4. **Assess.** For each "rule that fired", say whether it is real or an
   artefact of the data (a gap because of travel is not a stall). Then, for
   each open question in DECISIONS.md, say whether the data answers it yet.
   Then the trend on the three lifts: reference per block, increments earned
   vs the one-per-block expectation.
5. **Next steps.** Concrete, ordered, and only what the rules and data
   support. Distinguish: (a) do now inside the program (a swap, a deload, a
   rung held) — no review needed; (b) a program change — must go through the
   Opus reviewer (`.claude/agents/program-reviewer.md`) before anything in
   `src/program/` changes; say so and ask before spawning it.
6. **Record.** If anything is decided, append a dated entry to
   `coach/DECISIONS.md` with the data it rested on. Update
   `research/BRIEF.md` if the athlete profile changed (bodyweight band,
   running level, injury). Do not commit training data or reports.

## Output shape

- One paragraph: where he is (block, week, role, run week) and the headline.
- "What the data says" — lifts, running, core, recovery: numbers, not adjectives.
- "Rules that fired" — each one judged.
- "Next steps" — numbered, marked (a) or (b).
- The report path.
