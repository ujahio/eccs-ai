# E-Clinical Case Solutions

ECCS is planned as a full-stack TypeScript application using Next.js, React, Tailwind, Radix UI, Bun, SST Ion, AWS serverless services, DynamoDB, Cognito, SES, MailSurp, Vitest, and Playwright.

The product UI source of truth is [DESIGN.md](./DESIGN.md). Implementation work should follow the phased checklist in [plan.md](./plan.md).

## Local Stage

Use `local` as the local SST stage name.

Run the Next.js app through SST dev so local resource links and environment
bindings come from SST:

```sh
bun run dev
bun run sst:remove
```

Do not add Terraform, Pulumi, CDK, CloudFormation templates, or other IaC. AWS resources should be defined through SST Ion only.

## Environment

Create local environment files from the sample:

```sh
cp .env.sample .env.local
```

Keep secrets local. Do not commit `.env.local` or real credentials.

Required local conventions:

- `SST_STAGE=local`
- `BETTER_AUTH_SECRET` is a local-only secret.
- `BETTER_AUTH_URL=http://localhost:3001` for local Next.js development.
- `MAILSURP_API_KEY` and `MAILSURP_INBOX_ID` are used for local email testing.

Production email must use AWS SES resources managed by SST.

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

The dev script runs `sst dev --stage local` and starts Next.js as the child app
on `http://localhost:3001`.
Do not run `next dev` by itself for normal local development.

Dependencies should be pinned to exact versions when they are added.

## Manual AWS/SST Setup

Before running SST locally:

1. Confirm AWS OIDC authentication is configured for the app environment.
2. Bootstrap or initialize SST only through SST's supported workflow.
3. Run local infrastructure commands with `--stage local`.
4. Configure SES sender/domain verification for production stages through SST-managed resources.
5. Configure MailSurp credentials locally for test email flows.

Do not commit generated credentials, account-specific secrets, or Graphify harness artifacts.
