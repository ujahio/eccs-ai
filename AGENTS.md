# CRITICAL RULES - MUST FOLLOW

## Agent skills

### Environment

Keep secrets local. Do not commit an environment file matching `.env.*` unless it is `.env.sample`.

Read `.env.sample` for required local environment variables.

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `ujahio/eccs-ai`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo. Read `PRD.md` for product scope and `DESIGN.md` for UI rules before planning implementation work. See `docs/agents/domain.md`.

Read `docs/adr/README.md` and the ADRs relevant to an area before planning or implementing architecture-affecting work. Accepted ADRs are architectural constraints. Preserve them as history; replace a decision only with a new ADR that supersedes the previous one.

## Implementation Details

### Tech Stack

#### Application

- **Full-stack TypeScript** using React.js and Next.js
- **UI/UX** with tailwind, radix-ui
- **SST Ion** as the sole infrastructure-as-code and deployment system. Do not introduce another infrastructure control plane. AWS SDK v3 is allowed for application runtime access to AWS services.
- **EMAIL Services** Resend for application email delivery; local Playwright auth flows use the isolated in-memory e2e harness
- **Client Authentication** with better-auth (no database, use cognito for user management)
- **AWS** for backend resources
- **Bun** runtime
- **Playwright** for end-to-end integration AND smoketests tests
- **vitest** for unit testing
- **vite** for tooling

#### Architecture Notes

- ECCS is currently a feature-oriented Next.js modular monolith.
- Keep route handlers and server actions thin, place business behavior in `src/features/*`, and preserve established feature-owned interfaces to external systems.
- Do not change an accepted architectural decision without creating a new ADR that supersedes it.

### Architecture changes

Create a `Proposed` ADR before implementing a consequential change to system or feature boundaries, infrastructure or deployment topology, authentication or authorization, persistence or data ownership, public APIs or integration contracts, external providers or major dependencies, or background processing and operational behavior. Routine implementation details do not require an ADR.

Use the lifecycle `Proposed` → `Accepted` → `Superseded` or `Deprecated`. A change to an accepted decision requires a new ADR that supersedes it; do not rewrite or delete the earlier ADR.

### Tech consideration

- Pin dependencies versions
- start with one local stage and inform the user of the manual steps to implement
- Testing selectors must use `data-testid` first. Use stable `id` attributes as a close second when a test id would duplicate an existing semantic anchor. Avoid relying on visible text, ARIA roles, CSS classes, or layout structure for automated test targeting unless no stable selector is available.

## UI DESIGN

- Always follow the UI design system when creating or reviewing components or pages @DESIGN.md

## PLANNING MODE

- Always ask clarifying questions
- Never assume design, tech stack or features
- Use deep-dive sub-agents to assist with research
- Use deep-dive sub-agents to review the different aspects of your plan before presenting to the user

## CHANGE / EDIT MODE

- Never implement features yourself when possible - use sub-agents!
- Identify changes from the plan that can be implemented in parallel, and use sub-agents to implement the features efficiently
- When using sub-agents to implement features, act as a coordinator only
- Run lint, typecheck, and build as PR-preparation checks before pushing or opening a PR, or earlier when the user explicitly asks for those checks.
- When code is ready to commit, ask the user to manually test it before staging or committing.

## Documentation

- if there is an MCP for a package, use the MCP
- if you need documentation on AWS, use agent-toolkit
- use `context7` tools any other documentation tools with no MCP

## Runtime

Use `bun` and/or `bunx` (whichever is appropriate) for runtime commands.

Do not run `sst dev` or `bun run dev` from the agent shell. The user will run
SST dev locally after authenticating to AWS.

## Github Operations

### Github Authentication

- GitHub operations are allowed for this repository through the `gh` CLI, including reading issues/PRs, commenting, applying labels, creating branches, opening PRs, and closeout workflow steps.
- Do not ask for separate approval before routine `gh` operations in this repository.
- Use the currently authenticated GitHub session. If authentication is missing or insufficient, report the blocker and ask the user to authenticate.
- Do not read or modify secrets. Treat `.github` workflow/config files as normal repo files only when they are relevant to the task.
- Do not assume GitHub deployment workflows are operational. Their definitions currently use `.md` extensions and are disabled; see ADR 0009.

### Branch, PR, And Issue Closeout Workflow

- Create issue implementation branches from `staging` unless the user explicitly requests a different base.
- Follow the branch, PR, and issue closeout conventions in `docs/agents/issue-tracker.md`.

## SST

SST component files must live under `infra/` and be imported from inside
`sst.config.ts` `run()` with dynamic imports. Do not define SST resources inline
in `sst.config.ts`, and do not use top-level imports in `sst.config.ts`.
Component files should instantiate public SST components and resource outputs as
exported constants, for example `export const client = new sst.aws.Nextjs(...)`.
Provider resources such as `new aws.*` may remain unexported when they are
private implementation details of the component file.

Scripts that interact with resources created by SST must be TypeScript files
under `scripts/` and read linked resource names or IDs from `Resource` imported
from `sst`. Run those scripts through `sst shell`, for example
`bunx sst shell --stage ailocal -- bun scripts/example.ts`, so linked resources
are available to the process. Do not duplicate SST resource names in standalone
environment variables.
