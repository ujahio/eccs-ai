# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring or planning work.

## Before Exploring, Read These

- `PRD.md` at the repo root for the v1 product scope and implementation decisions.
- `DESIGN.md` at the repo root for UI design system rules.
- `AGENTS.md` at the repo root for technology, runtime, GitHub, SST, and agent behavior rules.
- `docs/adr/` if it exists, reading ADRs that touch the area being changed.
- `CONTEXT.md` or `CONTEXT-MAP.md` if either is introduced later.

If optional context files or ADR directories do not exist, proceed silently.

## File Structure

This is currently a single-context repo:

```text
/
├── AGENTS.md
├── DESIGN.md
├── PRD.md
└── docs/
    └── agents/
```

## Use ECCS Vocabulary

Use the product language from `PRD.md` in issue titles, acceptance criteria, test names, and implementation notes. Prefer terms such as `student`, `teacher`, `case`, `active case`, `archived case`, `personal analysis`, `model answer`, `teaching resources`, `CME quiz`, `certificate`, and `partner medical facility`.

## Flag Decision Conflicts

If planned work contradicts `PRD.md`, `DESIGN.md`, `AGENTS.md`, or an ADR, surface the conflict explicitly rather than silently overriding it.
