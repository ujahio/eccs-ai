# ADR 0009: Use stage-isolated, OIDC-authenticated deployment promotion

- **Status:** Accepted (retrospectively documented; not currently operational)
- **Decision date:** 2026-07-25
- **Recorded date:** 2026-09-15

## Context

ECCS uses SST stages to allocate AWS resources. Feature work is integrated through `staging`, while production promotion needs evidence that the same commit passed application checks, deployed successfully to staging, and passed a compact smoke suite against real AWS and email infrastructure before it reaches the protected production stage.

Long-lived AWS access keys are not part of the repository design. GitHub Actions assumes environment-specific AWS roles through OIDC. Production resources are retained and protected by SST, while disposable production-candidate resources must be isolated from both staging and production.

The workflow definitions currently have `.md` extensions under `.github/workflows/`, not GitHub Actions `.yml` or `.yaml` extensions. GitHub Actions does not load these files as workflows, so the accepted deployment design described here and in the runbook is disabled and is not operational today.

## Decision

Use three GitHub Environments—`staging`, `production-smoke`, and `production`—whose names align with their SST deployment responsibilities. Authenticate AWS deployment jobs by assuming environment-scoped IAM roles through GitHub OIDC.

Integrate feature PRs into `staging`. On a push to `staging`, deploy that SST stage. Permit production promotion only from the same repository's `staging` branch. Before a production PR may merge, require successful PR checks for the candidate commit, a successful staging deployment for that commit, and a real-infrastructure smoke deployment in a unique `production-pr-<pull-request-number>` SST stage.

Run the compact smoke suite with the in-memory auth mode disabled, using real Cognito and Resend behavior. Remove the temporary smoke stage after success; retain it after a smoke failure for diagnosis. After the promotion PR merges, deploy the protected `production` SST stage. Recover from a bad release through a forward deployment of a reverted or corrected commit.

This is the accepted design, but it remains intentionally inactive while the workflow files retain their `.md` extensions.

## Alternatives considered

- **Direct pushes to production:** Explicitly rejected by the runbook; production promotion must originate from the same-repository `staging` branch.
- **Using the in-memory E2E harness for production readiness:** Explicitly rejected for the production-smoke environment; the smoke suite must exercise real infrastructure.
- No broader deployment-platform or credential-mechanism comparison is recorded.

## Consequences

- AWS credentials do not need to be stored as long-lived GitHub secrets; each environment instead requires an assumable `AWS_ROLE_ARN` and `AWS_REGION`.
- Stage-specific application secrets and URLs must be configured in matching GitHub Environments.
- Each production candidate receives isolated AWS resources and a unique smoke URL and test identity namespace.
- Successful smoke stages are removed to control resource usage; failed smoke stages deliberately remain for debugging and require later cleanup.
- Production promotion depends on branch protection and checks that correlate the PR head SHA with PR checks and the staging deployment.
- Production rollback is a forward deploy rather than an in-place SST removal because production resources are retained and protected.
- None of these automated gates or deployments currently run from the checked-in definitions because all four workflow files are named `*.md`.

## Evidence

- Commit `5f2ecea974031a4522fd2bd7f9653f0a72dbe16a` (2026-07-16), `Set up stage deployment workflows`, established the staged workflow structure.
- Commit `f90dbcdc9b3218c89395f15516d8a289362ec559` (2026-07-17), `Auto deploy staging after merge`, established push-triggered staging deployment.
- Commit `6bd02db` (2026-07-18), `add failure mechanism for auth oidc`, and related deployment commits document OIDC-authenticated AWS deployment behavior.
- Commit `cc7e41829900538aad700d97200cd65ad857de44` (2026-07-25), `Add staging-first production smoke readiness`, introduced the production promotion design and runbook.
- Commits `1d1565f` (2026-07-25), `Gate production smoke on PR checks`, `4fd63a6` (2026-07-25), `Retain smoke infra when tests fail`, and `e35cc8c` (2026-07-25), `Use single smoke test mailbox`, refined the gates and isolation behavior.
- Commits `cf9f3ba96851449be1e2c189440cf5abf8856dc4` (2026-07-28), `temp disable workflows`, and `980e5d9c7b19f73dec0c1517c2996be76e5eb657` (2026-07-28), `change last workflow name`, renamed the workflow definitions from executable YAML extensions to `.md`.
- `docs/deployment-promotion.md` defines the environments, branch protections, workflow sequence, smoke contract, retained evidence, and forward-deploy rollback process.
- `.github/workflows/pr-checks.md`, `.github/workflows/deploy-stage.md`, `.github/workflows/production-pr-readiness.md`, and `.github/workflows/deploy-production.md` contain the disabled workflow definitions.
- `.env.sample` states that GitHub Actions assumes `AWS_ROLE_ARN` through OIDC rather than configuring AWS access-key secrets.
- `sst.config.ts` retains and protects the `production` stage while allowing non-production stages to be removed.
