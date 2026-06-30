# CRITICAL RULES - MUST FOLLOW

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `otktechnologies/eccs-ai`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo. Read `PRD.md` for product scope and `DESIGN.md` for UI rules before planning implementation work. See `docs/agents/domain.md`.

## Implementation Details

### Tech Stack

#### Application

- **Full-stack TypeScript** using React.js and Next.js
- **UI/UX** with tailwind, radix-ui
- **SST ION** to write components to deploy AWS (other). Do not use any other SDK or IAC.
- **EMAIL Services** AWS SES (via SST) for production and MailSurp for testing email client
- **Client Authentication** with better-auth (no database, use cognito for user management)
- **AWS** for backend resources
- **DynamoDB** use SST
- **Bun** runtime
- **Playwright** for end-to-end integration AND smoketests tests
- **vitest** for unit testing
- **vite** for tooling

#### Architecture Notes

- **Clean Architecture** with appropriate abstractions and coherent typescripit types throughout the application
- **Serverless** architecture for low-cost operations. API Gateway + Lambda. No need for API application layer like express.js or related tech.

#### Harness

- **Graphify** knowledge graphs (setup for codex, do not commit to upstream branch)

### Tech consideration

- Pin dependencies versions
- caching when necessary
- start with one local stage and inform the user of the manual steps to implement
- Testing selectors must use `data-testid` first. Use stable `id` attributes as a close second when a test id would duplicate an existing semantic anchor. Avoid relying on visible text, ARIA roles, CSS classes, or layout structure for automated test targeting unless no stable selector is available.

## UI DESIGN

- Always follow the UI design system when creating or reviewing components or pages.
- Design System: @DESIGN.md
- All images used by components must live under `public/images` and be referenced from that public path. If an image starts elsewhere, move it into `public/images` before using it in UI code.

## RESPONSES

- Keep responses concise and to the point - unless the user asks otherwise

## PLANNING MODE

- Always ask clarifying questions
- Never assume design, tech stack or features
- Use deep-dive sub-agents to assist with research
- Use deep-dive sub-agents to review the different aspects of your plan before presenting to the user

## CHANGE / EDIT MODE

- Never implement features yourself when possible - use sub-agents!
- Identify changes from the plan that can be implemented in parallel, and use sub-agents to implement the features efficiently
- When using sub-agents to implement features, act as a coordinator only
- Use the best model for the task - premium models for complex tasks (like coding) and mid-tier models for simpler tasks, like documentation
- Run lint, typecheck, and build only after a commit has taken place or when the user explicitly asks for those checks.

## Context7

When you need to search for up to date documentation, use `context7` tools.

## Runtime

Use `bun` and `bunx` for all runtime commands.

Do not run `sst dev` or `bun run dev` from the agent shell. The user will run
SST dev locally after authenticating to AWS.

## Github Operations

### Github Authentication

- For any task that requires Github authentication or reading of .github or related files, ask the user before performing the task. Explain if necessary why authentication is needed. Do not perform any github actions.

## SST

SST component files must live under `infra/` and be imported from inside
`sst.config.ts` `run()` with dynamic imports. Do not define SST resources inline
in `sst.config.ts`, and do not use top-level imports in `sst.config.ts`.
Component files should instantiate resources as exported constants, for example
`export const client = new sst.aws.Nextjs(...)`.
