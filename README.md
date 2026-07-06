# E-Clinical Case Solutions

ECCS is planned as a full-stack TypeScript application using Next.js, React, Tailwind, Radix UI, Bun, SST Ion, AWS serverless services, DynamoDB, Cognito, Resend, Vitest, and Playwright.

The product UI source of truth is [DESIGN.md](./DESIGN.md). Implementation work should follow the phased checklist in [plan.md](./plan.md).

## Local Stage

Use `ailocal` as the local SST stage name.

Run the Next.js app through SST dev so local resource links and environment
bindings come from SST:

```sh
bun run dev
bun run sst:remove
```

Do not add Terraform, Pulumi, CDK, CloudFormation templates, or other IaC. AWS resources should be defined through SST Ion only.

## Bun Commands

Use Node 24 with Bun and Bunx for runtime, package, script, and tooling commands.
This repo includes `.node-version` and `.nvmrc` set to Node 24.

Expected commands once the app scaffold exists:

```sh
bun install
bun run dev
bun run lint
bun run typecheck
bun run test
bun run test:e2e
bun run build
```

The dev script runs `sst dev --stage ailocal` and starts Next.js as the child app
on `http://localhost:3001`.
Do not run `next dev` by itself for normal local development.

Dependencies should be pinned to exact versions when they are added.

## Manual AWS/SST Setup

Before running SST locally:

1. Confirm AWS OIDC authentication is configured for the app environment.
2. Bootstrap or initialize SST only through SST's supported workflow.
3. Run local infrastructure commands with `--stage ailocal`.
4. Configure Resend API credentials and sender/domain verification for stages that send real email.
5. Use `bun run test:e2e:local` for isolated local auth flows backed by the in-memory e2e harness.

Do not commit generated credentials, account-specific secrets, or Graphify harness artifacts.
