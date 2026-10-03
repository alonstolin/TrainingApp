# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root, or
- **`GLOSSARY-MAP.md`** at the repo root if it exists: it points at one `GLOSSARY.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## This repo also has `coach/DECISIONS.md` — route by subject, not by habit

This repo is a training-program app with a second, pre-existing decision log: `coach/DECISIONS.md` (see `CLAUDE.md`), the dated record of program decisions — what the program prescribes, how a session is validated, exercise/scheme/progression changes. It predates this doc layout and stays authoritative for that subject.

**Before writing a new ADR, decide which log the decision belongs to:**

- Changes what the program prescribes, or how a logged session is judged against it (a new exercise, a changed scheme, a progression or validation rule, the reasoning behind a program version bump) → `coach/DECISIONS.md`, even when the change was made by editing code.
- Changes the app's own architecture (storage schema, service-worker strategy, a UI convention, a module boundary) → `docs/adr/`, even when a research agent's findings motivated it.

When unsure which side a decision falls on, ask rather than default to `docs/adr/` — writing a program decision there would fork this repo's decision history into two places nothing cross-references.

## File structure

Single-context repo (most repos):

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repo (presence of `GLOSSARY-MAP.md` at the root):

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
