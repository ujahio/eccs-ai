# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `otktechnologies/eccs-ai`.

Use the `gh` CLI for issue operations after the user explicitly approves GitHub-authenticated actions, as required by `AGENTS.md`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <path> --label "ready-for-agent"` or `--label "ready-for-human"`.
- **Issue before branch**: create or identify the GitHub issue before creating an implementation branch.
- **Branch from issue title**: after the issue exists, create or switch to a dedicated branch named from the issue number and title. Use a three-digit issue number plus a short slug from the title, for example `003-student-registration-verification` for issue 3, "Student registration and 24-hour email verification".
- **Branch scope**: do not implement issue work directly on `main`. Keep one implementation branch focused on one issue unless the user explicitly asks otherwise.
- **Read an issue**: `gh issue view <number> --comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`
- **Closeout PR**: when implementation work is ready, create a pull request before closing the issue. The PR body must mention and link the issue it solves, using GitHub closing keywords such as `Closes #123` where appropriate.
- **Close after PR**: close an issue only after a PR exists and represents the completed work for that issue.

## PR summary template

When creating or updating a pull request summary, highlight outcomes first, then note any PRD or issue-tracker coordination that affects review or follow-up work. Use this template:

```md
## Summary

Briefly describe the user-facing or system-level outcome of this PR.

## Work Done

- Added/updated the main feature behavior.
- Added supporting infrastructure, API, or data model changes.
- Updated UI flows, validation, or error handling.
- Added or updated tests for the critical path.

## PRD Changes

- List short notes about any PRD updates made for this work.
- If no PRD changed, write `None`.

## Issue Notes

- Note if the current issue changed during implementation.
- Note any downstream or related issues affected by changes to the current issue.
- If no issue notes apply, write `None`.

## Verification

- `bun test`
- `bun run typecheck`
- `bun run lint`
- Playwright smoke/integration test result, if relevant.
- Manual verification notes, if relevant.

## Risks / Review Focus

- Mention tricky logic, auth/security-sensitive paths, data migrations, or known limitations.
- Mention anything intentionally deferred.

## Linked Issue

Closes #123
```

Infer the repo from `git remote -v`; `gh` does this automatically when run inside the clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in dependency order, blockers first, after explicit user approval for GitHub actions.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments` after explicit user approval for GitHub actions.
