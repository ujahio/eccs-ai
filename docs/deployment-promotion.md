# Deployment Promotion Runbook

This runbook covers the first production-readiness pass only: feature PRs into `staging`, staging promotion to `production`, production smoke orchestration, smoke-stage teardown, and production deployment after merge. Staging deploys remain independent and run from pushes to the `staging` branch.

## First-Pass Scope

The production PR smoke scope is intentionally compact:

1. Registration and login.
2. Teacher publishes a case with an attachment.
3. Student completes the case and downloads the certificate.
4. Password reset.

Email change, deadline cutoff, reminder delivery, observability, backup drills, WAF/rate limits, and accessibility evidence remain separate readiness items.

## Required GitHub Environments

Create these GitHub Environments before enforcing the workflows:

- `production`
- `production-smoke`
- `staging`

For automatic PR-triggered smoke runs, do not configure required reviewers on the `production-smoke` environment. Use branch protection and required workflow checks to control merges.

Configure these values on the matching environment:

| Name | Type | Environments | Purpose |
| --- | --- | --- | --- |
| `AWS_REGION` | Variable | `production`, `production-smoke`, `staging` | AWS region for OIDC deployment. |
| `AWS_ROLE_ARN` | Secret | `production`, `production-smoke`, `staging` | Role assumed by GitHub Actions. Use a smoke-scoped role for `production-smoke` that can deploy and remove only `production-pr-*` smoke stages. |
| `BETTER_AUTH_SECRET` | Secret | `production`, `production-smoke`, `staging` | better-auth signing secret. Use a separate value for `production-smoke`. |
| `BETTER_AUTH_URL` | Variable | `production`, `staging` | Canonical app auth URL. Must be HTTPS outside local stages. |
| `NEXT_PUBLIC_APP_URL` | Variable | `production`, `staging` | Public app URL. Must be HTTPS outside local stages. |
| `PRODUCTION_SMOKE_APP_URL` | Variable | `production-smoke` | Public HTTPS URL routed to the temporary production PR smoke stage. Used for `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and Playwright `baseURL` during smoke. |
| `ECCS_EMAIL_SENDER` | Variable | `production`, `production-smoke`, `staging` | Verified Resend sender for application email. |
| `RESEND_API_KEY` | Secret | `production`, `production-smoke`, `staging` | Resend API key. Use a smoke-scoped key or sender/domain for `production-smoke` where available. |
| `SMOKE_EMAIL_DOMAIN` | Variable | `production-smoke` | Domain used for unique smoke student accounts and the smoke teacher account. |
| `SMOKE_TEACHER_TEMP_PASSWORD` | Secret | `production-smoke` | Temporary password used by `scripts/bootstrap-teacher.ts` when creating the smoke teacher. |
| `SMOKE_TEACHER_PASSWORD` | Secret | `production-smoke` | Permanent teacher password set through the first-login change flow and used on retry when the teacher already completed first login. |

`AUTH_E2E_MODE` must be empty for `production` and `production-smoke`. Do not configure real-infra smoke with the memory harness.

## Branch Protection

Protect the `production` branch and require these checks before merge:

- `PR Checks / Lint, Typecheck, Test, Build`
- `Production PR Readiness / Require staging source`
- `Production PR Readiness / Deploy, Smoke, And Teardown Production PR Candidate`

Protect `staging` with `PR Checks / Lint, Typecheck, Test, Build`. Feature and issue PRs should target `staging`, not `main` or `production`.

Protect `production` so it does not allow direct pushes. The only allowed production promotion PR source is the same-repository `staging` branch, enforced by `Production PR Readiness / Require staging source`.

`Deploy Production / Deploy production` runs after merge from the push to `production`, so it should be monitored as post-merge deployment evidence rather than configured as a pre-merge required check.

## Workflow Sequence

1. Open feature and issue PRs targeting `staging`.
2. `PR Checks` runs lint, typecheck, unit tests, build, and memory e2e.
3. After merge, the push to `staging` triggers `Deploy Staging`.
4. Open a promotion PR from same-repository `staging` into `production`.
5. `Production PR Readiness / Require staging source` rejects any production PR that is not from same-repository `staging`.
6. `Production PR Readiness` validates required `production-smoke` environment values.
7. The workflow deploys a PR-specific SST stage named `production-pr-<pull-request-number>`.
8. The workflow bootstraps the smoke teacher with `scripts/bootstrap-teacher.ts`.
9. The workflow runs `REAL_INFRA_SMOKE=1 bun run test:e2e:production-smoke` against `PLAYWRIGHT_BASE_URL=$PRODUCTION_SMOKE_APP_URL`.
10. The workflow always runs `bunx sst remove --stage production-pr-<pull-request-number>` after a successful smoke-stage deployment, including when smoke fails.
11. After the staging promotion PR is merged, the push to `production` triggers `Deploy Production`.
12. `Deploy Production` deploys the real SST `production` stage with `bunx sst deploy --stage production`.

Production is configured in `sst.config.ts` with retained, protected resources. The production PR smoke workflow uses the `production-smoke` GitHub Environment and must not run `sst remove --stage production`; it removes only the temporary `production-pr-*` smoke stage. It must not deploy or invoke the `staging` branch.

## Smoke Test Contract

The smoke suite should be self-contained and fail closed. It must:

- Run against the deployed smoke URL from `PLAYWRIGHT_BASE_URL`.
- Use real Cognito and Resend behavior.
- Exercise only the four first-pass smoke flows listed above.
- Create uniquely prefixed test data.
- Avoid memory-only `/api/e2e/*` helpers.
- Disable Playwright trace, screenshots, and video for real-infra smoke so email verification and reset links are not retained in CI artifacts.

## Artifacts

Every production PR run should retain:

- `production-smoke-deploy-summary`
- `production-smoke-teardown`

Use these artifacts as release evidence before merging to `production`.

After merge, the production deployment workflow retains `production-deploy-summary`.

The staging deployment workflow writes `staging-deploy-summary` only for independent pushes to the `staging` branch.

## Rollback

Because production resources are retained and protected, rollback is a forward deploy of a known-good commit:

1. Revert or fix the candidate branch.
2. Open or update the PR targeting `staging`.
3. Merge to `staging` only after checks pass.
4. Open or update the same-repository `staging` to `production` promotion PR.
5. Let the production PR workflow redeploy, smoke, and tear down its temporary smoke stage.
6. Merge only after all production promotion checks pass on the latest `staging` commit.
7. Let the automatic push-triggered `Deploy Production` workflow deploy the `production` stage.

If a deployed candidate causes an incident before production merge, update `staging` with a known-good fix or revert commit, then let the automatic production PR readiness workflow redeploy, smoke, and tear down its temporary smoke stage. Real production deploy happens only after the corrected staging promotion PR is merged into `production`.
