# Architecture Decision Records

This directory records architecturally significant ECCS decisions: choices that shape system boundaries, infrastructure, security, persistence, deployment, or other behavior that is expensive to reverse. ADRs preserve why the architecture has its current form and provide a durable review point when that architecture changes.

## Decision index

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](./0001-use-a-feature-oriented-nextjs-modular-monolith.md) | Use a feature-oriented Next.js modular monolith | Accepted (retrospectively documented) |
| [0002](./0002-use-sst-ion-for-aws-serverless-deployment.md) | Use SST Ion for AWS serverless deployment | Accepted (retrospectively documented) |
| [0003](./0003-use-cognito-backed-identities-with-better-auth-sessions.md) | Use Cognito-backed identities with Better Auth sessions | Accepted (retrospectively documented) |
| [0004](./0004-persist-application-records-in-access-pattern-specific-dynamodb-tables.md) | Persist application records in access-pattern-specific DynamoDB tables | Accepted (retrospectively documented) |
| [0005](./0005-store-case-materials-in-private-versioned-s3.md) | Store case materials in private, versioned S3 | Accepted (retrospectively documented) |
| [0006](./0006-use-ports-and-adapters-with-an-isolated-e2e-runtime.md) | Use ports and adapters with an isolated E2E runtime | Accepted (retrospectively documented) |
| [0007](./0007-use-deadline-derived-case-availability-with-scheduled-archival.md) | Use deadline-derived case availability with scheduled archival | Accepted (retrospectively documented) |
| [0008](./0008-use-resend-for-transactional-email.md) | Use Resend for transactional email | Accepted (retrospectively documented) |
| [0009](./0009-use-stage-isolated-oidc-authenticated-deployment-promotion.md) | Use stage-isolated, OIDC-authenticated deployment promotion | Accepted (retrospectively documented; not currently operational) |

ADR 0009 describes the accepted deployment design, but that design is not operational today: its GitHub Actions definitions are stored as `.md` files rather than executable `.yml` or `.yaml` workflow files.

## Retrospective evidence convention

ADRs 0001–0009 were created after the decisions had already been made or implemented. They follow these evidence rules:

- **Decision date** is the earliest repository date that establishes the decision. When the exact date is not provable, the ADR must say that the decision existed by or before the cited date.
- **Recorded date** is the date the retrospective ADR was written, not a backdated creation date.
- **Evidence** cites tracked documentation, implementation files, and Git commits that support the recorded context, decision, and consequences.
- Missing rationale or alternatives are recorded as unknown. Do not invent rejected alternatives, motivations, or trade-off discussions that the evidence does not establish.
- Clearly distinguish verified facts from reasonable inference. An inference must not be presented as historical intent.

## Lifecycle for future decisions

Use this lifecycle for new architectural decisions:

`Proposed` → `Accepted` → `Superseded` or `Deprecated`

Create a `Proposed` ADR before implementing a consequential architecture change whenever practical. Review its context, alternatives, decision, and consequences, then change its status to `Accepted` when the team commits to that direction.

Never delete an old ADR or rewrite it to make history appear current. When replacing an accepted decision:

1. Create a new ADR with the next sequence number.
2. State which earlier ADR it supersedes and link to it.
3. Update the earlier ADR's status to `Superseded by ADR NNNN` and add a link to the replacement.
4. Preserve the earlier ADR's original context, decision, alternatives, and consequences.

Use `Deprecated` when a decision is no longer recommended or applicable but has no direct replacement. Implementation pull requests should link the relevant proposed or accepted ADR, and architecture documentation should be updated when the implementation changes the current system view.
