# SST Deployment Strategy

ECCS uses the SST stage name as the AWS resource allocation boundary. A deploy
to `staging` creates or updates staging resources; a deploy to `production`
creates or updates production resources.

## Stage Contract

| Purpose | SST stage | GitHub Environment | Deployment path |
| --- | --- | --- | --- |
| Local development | `ailocal` | none | `bun run dev` |
| Shared validation | `staging` | `staging` | `Deploy SST Stage` workflow or `bun run sst:deploy:staging` |
| Live production | `production` | `production` | `Deploy SST Stage` workflow |

The GitHub Environment name must match the SST stage exactly. This keeps
environment-scoped secrets, approval rules, and allocated AWS resources aligned.

The current [sst.config.ts](../sst.config.ts) protects only the exact
`production` stage by retaining resources and blocking removal. Do not deploy a
stage named `prod` unless you intentionally want a separate, unprotected SST
environment.

## Pull Request Checks

[pr-checks.yml](../.github/workflows/pr-checks.yml) is the pre-merge validation
gate for pull requests to `main`.

It runs:

- `bun run lint`
- `bun run test`
- `bun run build`
- `bun run test:e2e:memory` for smoke and integration coverage

The smoke and integration tests use the in-memory e2e auth harness and do not
need real AWS, Cognito, Resend, or SST-linked resources.

## Stage Deployment

Use the `Deploy SST Stage` workflow to deploy an environment.

1. Open GitHub Actions.
2. Select `Deploy SST Stage`.
3. Choose the branch or commit to deploy.
4. Choose the SST `stage`: `staging` or `production`.
5. Approve the matching GitHub Environment gate if one is configured.

The deployment workflow:

- uses `workflow_dispatch` so deployment is intentional;
- deploys only the selected SST stage;
- maps the selected stage to the GitHub Environment with the same name;
- assumes an AWS role through GitHub OIDC;
- requires production deployments to run from `main`;
- serializes deployments per stage with `deploy-${stage}` concurrency.

It does not run the full test suite. PR checks own validation; this workflow
owns resource deployment.

## GitHub Environment Setup

Create GitHub Environments named exactly:

- `staging`
- `production`

Configure these secrets in each environment:

| Secret | Purpose |
| --- | --- |
| `AWS_ROLE_ARN` | AWS IAM role that GitHub Actions can assume through OIDC for this stage. |
| `BETTER_AUTH_SECRET` | Stage-specific Better Auth secret. |
| `RESEND_API_KEY` | Stage-specific Resend API key. |

Configure these variables in each environment:

| Variable | Purpose |
| --- | --- |
| `AWS_REGION` | AWS region for SST deploys, for example `us-east-1`. |
| `NEXT_PUBLIC_APP_URL` | Public URL for the deployed stage. |
| `BETTER_AUTH_URL` | Auth callback/base URL. Usually the same value as `NEXT_PUBLIC_APP_URL`. |
| `ECCS_EMAIL_SENDER` | Verified sender address for Cognito custom email delivery. |

Example staging configuration:

```text
AWS_ROLE_ARN=arn:aws:iam::<staging-account-id>:role/eccs-ai-github-staging-deploy
BETTER_AUTH_SECRET=<staging secret>
RESEND_API_KEY=<staging resend key>
AWS_REGION=us-east-1
NEXT_PUBLIC_APP_URL=https://staging.eccs.example
BETTER_AUTH_URL=https://staging.eccs.example
ECCS_EMAIL_SENDER=ECCS <no-reply@staging.eccs.example>
```

Example production configuration:

```text
AWS_ROLE_ARN=arn:aws:iam::<production-account-id>:role/eccs-ai-github-production-deploy
BETTER_AUTH_SECRET=<production secret>
RESEND_API_KEY=<production resend key>
AWS_REGION=us-east-1
NEXT_PUBLIC_APP_URL=https://eccs.example
BETTER_AUTH_URL=https://eccs.example
ECCS_EMAIL_SENDER=ECCS <no-reply@eccs.example>
```

Recommended protection:

- `staging`: allow trusted maintainers to deploy.
- `production`: require reviewer approval and restrict deployment branches to
  `main`.

## SSO And OIDC Strategy

Use two separate access paths:

| Actor | Access path | Purpose |
| --- | --- | --- |
| Humans | AWS SSO / IAM Identity Center | Administer AWS accounts, create OIDC provider, create or rotate deploy roles, inspect resources. |
| GitHub Actions | GitHub OIDC -> AWS IAM role | Deploy SST resources for one stage without storing AWS access keys. |

Do not add `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` to GitHub. The deploy
workflow requests an OIDC token with `id-token: write` and passes `AWS_ROLE_ARN`
to `aws-actions/configure-aws-credentials`.

Recommended role layout:

| Stage | IAM role name | GitHub Environment secret |
| --- | --- | --- |
| `staging` | `eccs-ai-github-staging-deploy` | `AWS_ROLE_ARN=arn:aws:iam::<account-id>:role/eccs-ai-github-staging-deploy` |
| `production` | `eccs-ai-github-production-deploy` | `AWS_ROLE_ARN=arn:aws:iam::<account-id>:role/eccs-ai-github-production-deploy` |

Separate AWS accounts per upper environment are preferred. If staging and
production share one AWS account, still use separate deploy roles and separate
GitHub Environments.

### OIDC Provider

Create one IAM OIDC identity provider per AWS account that GitHub Actions will
deploy into:

```text
Provider URL: https://token.actions.githubusercontent.com
Audience: sts.amazonaws.com
```

### Trust Policies

Use one trust policy per stage role. The important part is the exact
environment-scoped `sub` claim.

Staging role trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:otktechnologies/eccs-ai:environment:staging"
        }
      }
    }
  ]
}
```

Production role trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:otktechnologies/eccs-ai:environment:production"
        }
      }
    }
  ]
}
```

## Deploy Role Permissions

For the first deployment, use a dedicated deploy role with broad infrastructure
permissions because SST needs to create and update IAM roles and policies plus
the app resources in [infra/](../infra): Cognito, KMS, Lambda/Next.js hosting,
DynamoDB, S3, EventBridge Scheduler, CloudWatch Logs, and linked SST secrets.

Practical v1 options:

| Option | Use when | Notes |
| --- | --- | --- |
| Attach `AdministratorAccess` to the deploy role | You need the simplest reliable first deploy. | Keep the role tightly scoped by OIDC trust policy and GitHub Environment approvals. |
| Attach a custom SST deploy policy | Your AWS governance disallows admin deploy roles. | Start broad enough for SST/IAM creation, then tighten after the first successful deploy with CloudTrail/Access Analyzer evidence. |

After the first successful staging deploy, review CloudTrail events for the
deploy role and use that evidence to replace `AdministratorAccess` with a
custom managed policy if needed.

## Environment Variable Inventory

These values are configured manually in GitHub Environments:

| Name | GitHub location | Required for deploy | Notes |
| --- | --- | --- | --- |
| `AWS_ROLE_ARN` | Environment secret | yes | Used only by GitHub Actions to assume the stage deploy role through OIDC. |
| `AWS_REGION` | Environment variable | yes | Used by the AWS credential action and AWS SDK commands. |
| `BETTER_AUTH_SECRET` | Environment secret | yes | Deployed as an SST secret and read by app auth code. Use a unique value per stage. |
| `BETTER_AUTH_URL` | Environment variable | yes | Auth base URL. Keep this equal to `NEXT_PUBLIC_APP_URL` unless a stage needs a separate auth URL. |
| `ECCS_EMAIL_SENDER` | Environment variable | yes | Verified sender used by Cognito custom emails and app notification emails. |
| `NEXT_PUBLIC_APP_URL` | Environment variable | yes | Public app URL used in links, emails, and client/server runtime config. |
| `RESEND_API_KEY` | Environment secret | yes | Deployed as an SST secret and used for outbound email. |

These values are generated or test-only and should not be configured as normal
GitHub Environment values:

| Name | Source | Notes |
| --- | --- | --- |
| `AUTH_E2E_MODE` | PR checks or deploy workflow | `memory` is only for local/e2e test harnesses. Deploy clears it. |
| `CASE_ARCHIVE_SCHEDULE_GROUP_NAME` | SST deploy output | Injected by `infra/nextjs-client.ts`. |
| `CASE_ARCHIVE_SCHEDULE_NAME` | SST deploy output | Injected by `infra/nextjs-client.ts`. |
| `CASE_ARCHIVE_SCHEDULER_ROLE_ARN` | SST deploy output | Injected by `infra/nextjs-client.ts`. |
| `CASE_ARCHIVE_TARGET_ARN` | SST deploy output | Injected by `infra/nextjs-client.ts`. |
| `COGNITO_CUSTOM_SENDER_KEY_ARN` | SST deploy output | Injected into the Cognito custom email sender function by `infra/auth.ts`. |
| `E2E_HOST`, `E2E_PORT`, `PLAYWRIGHT_BASE_URL` | Local/e2e and smoke tests | PR checks let Playwright start the local app. Deployed smoke tests can set `PLAYWRIGHT_BASE_URL` later. |
| `ECCS_E2E_EMAIL_STORE_PATH` | Local/e2e tests | Used by the in-memory e2e auth harness only. |
| `NODE_ENV` | Platform/build runtime | Managed by the runtime. |

## Local Deployment Equivalent

Local staging deployment uses the same SST stage:

```sh
bun run sst:deploy:staging
```

Before running a local staging deploy, export the same stage-specific values
that the GitHub Environment would provide: `AWS_REGION`,
`NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`, `ECCS_EMAIL_SENDER`,
`BETTER_AUTH_SECRET`, and `RESEND_API_KEY`.

Stage names are durable infrastructure identifiers. Rename them only when you
intend to allocate a new set of AWS resources.
