# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `otktechnologies/eccs-ai`.

Use the `gh` CLI for issue operations after the user explicitly approves GitHub-authenticated actions, as required by `AGENTS.md`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <path> --label "ready-for-agent"` or `--label "ready-for-human"`.
- **Read an issue**: `gh issue view <number> --comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside the clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in dependency order, blockers first, after explicit user approval for GitHub actions.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments` after explicit user approval for GitHub actions.
