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
| `PRODUCTION_SMOKE_BASE_DOMAIN` | Variable | `production-smoke` | Base domain for temporary production PR smoke stages, for example `smoke.eccs-online.com`. The workflow derives `PRODUCTION_SMOKE_APP_URL=https://production-pr-<pull-request-number>.<base-domain>` and uses it for `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and Playwright `baseURL` during smoke. |
| `ECCS_EMAIL_SENDER` | Variable | `production`, `production-smoke`, `staging` | Verified Resend sender for application email. |
| `RESEND_API_KEY` | Secret | `production`, `production-smoke`, `staging` | Resend API key used to inspect outbound smoke emails sent to `SMOKE_TEST_MAILBOX` plus-addresses. |
| `SMOKE_TEST_MAILBOX` | Variable | `production-smoke` | Single controlled smoke mailbox, for example `smoke-tests@eccs-online.com`. The workflow and tests derive unique plus-addressed recipients from this mailbox, such as `smoke-tests+teacher-production-pr-42@eccs-online.com`. |
| `SMOKE_TEACHER_TEMP_PASSWORD` | Secret | `production-smoke` | Temporary password used by `scripts/bootstrap-teacher.ts` when creating or resetting the smoke teacher before the permanent password is applied. Playwright does not use this value. |
| `SMOKE_TEACHER_PASSWORD` | Secret | `production-smoke` | Permanent teacher password set by `scripts/bootstrap-teacher.ts` after the smoke teacher profile is ready. Playwright uses this value for direct teacher sign-in. |

`AUTH_E2E_MODE` must be empty for `production` and `production-smoke`. Do not configure real-infra smoke with the memory harness.

## Branch Protection

Protect the `production` branch and require these checks before merge:

- `PR Checks / Lint, Typecheck, Test, Build`
- `Production PR Readiness / Require staging source`
- `Production PR Readiness / Wait for successful PR Checks`
- `Production PR Readiness / Wait for successful Deploy Staging`
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
6. `Production PR Readiness / Wait for successful PR Checks` waits for `PR Checks / Lint, Typecheck, Test, Build` to complete successfully for the same production PR and head SHA.
7. If `PR Checks` fails, is cancelled, or times out, `Production PR Readiness` stops before deploying any real infrastructure smoke stage.
8. `Production PR Readiness / Wait for successful Deploy Staging` waits for the `Deploy Staging` push workflow to complete successfully for the same `staging` commit.
9. If `Deploy Staging` fails, is cancelled, or times out, `Production PR Readiness` stops before deploying any real infrastructure smoke stage.
10. `Production PR Readiness` validates required `production-smoke` environment values.
11. The workflow deploys a PR-specific SST stage named `production-pr-<pull-request-number>`.
12. The workflow derives the smoke teacher email as a plus-addressed recipient from `SMOKE_TEST_MAILBOX`, then bootstraps that teacher with `scripts/bootstrap-teacher.ts`. Bootstrap first deletes any existing generated smoke teacher identity in the stage, refusing to proceed if a non-smoke teacher exists. It then creates the new teacher, applies the permanent teacher password, and leaves Cognito ready for direct sign-in.
13. The workflow derives `PRODUCTION_SMOKE_APP_URL` from `SST_STAGE` and `PRODUCTION_SMOKE_BASE_DOMAIN`, then runs `REAL_INFRA_SMOKE=1 bun run test:e2e:production-smoke` against `PLAYWRIGHT_BASE_URL=$PRODUCTION_SMOKE_APP_URL`.
14. If the smoke suite passes, the workflow runs `bunx sst remove --stage production-pr-<pull-request-number>` to remove the temporary smoke stage.
15. If the smoke suite fails after the smoke stage deployed, the workflow fails and intentionally retains `production-pr-<pull-request-number>` for debugging or reruns.
16. After the staging promotion PR is merged, the push to `production` triggers `Deploy Production`.
17. `Deploy Production` deploys the real SST `production` stage with `bunx sst deploy --stage production`.

Production is configured in `sst.config.ts` with retained, protected resources. The production PR smoke workflow uses the `production-smoke` GitHub Environment and must not run `sst remove --stage production`; it removes only the temporary `production-pr-*` smoke stage. It must not deploy or invoke the `staging` branch.

## Smoke Test Contract

The smoke suite should be self-contained and fail closed. It must:

- Run against the deployed smoke URL from `PLAYWRIGHT_BASE_URL`.
- Use real Cognito and Resend behavior.
- Exercise only the four first-pass smoke flows listed above.
- Create uniquely prefixed test data.
- Use `SMOKE_TEST_MAILBOX` plus-addressing for all generated smoke recipients; no additional email domains or inboxes are created by the workflow.
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
