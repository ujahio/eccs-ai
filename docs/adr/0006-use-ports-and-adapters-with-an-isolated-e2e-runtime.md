# ADR 0006: Use ports and adapters with an isolated E2E runtime

- **Status:** Accepted (retrospectively documented)
- **Decision date:** 2026-07-01
- **Recorded date:** 2026-09-15

## Context

ECCS business workflows depend on Cognito, DynamoDB, S3, Resend, and EventBridge Scheduler. Local and automated end-to-end tests need to exercise the same application workflows without provisioning AWS resources or delivering real email on every run.

Feature services therefore depend on capability interfaces for identity, persistence, email, scheduling, and object storage. Production composition selects AWS and Resend adapters, while `AUTH_E2E_MODE=memory` selects in-memory adapters or no-op infrastructure behavior. Separate production smoke tests exercise the deployed integrations that the in-memory runtime cannot validate.

The repository explicitly documents isolated local auth flows and implements adapter boundaries across several features. It does not preserve a formal comparison with emulators, local AWS services, or test-only mocks at each call site. The broader architecture rationale is therefore only partially recoverable.

## Decision

Use ports and adapters for external capabilities, with an isolated in-memory E2E runtime:

- Define external capabilities as feature-owned interfaces where application services need identity, persistence, email, scheduling, or object storage.
- Construct production services with Cognito, DynamoDB, Resend, EventBridge Scheduler, and S3 adapters.
- When `AUTH_E2E_MODE=memory`, construct services with the shared in-memory E2E adapters and use no-op behavior where an external side effect is unnecessary.
- Run local E2E tests in memory mode.
- Retain real-infrastructure production smoke tests for behavior that requires deployed AWS, email, storage, permissions, and resource links.

## Alternatives considered

No reliable repository evidence records which alternatives were evaluated or rejected. It is unknown whether local AWS emulators, a fully mocked browser suite, or provisioning real infrastructure for every E2E run were formally considered.

## Consequences

### Positive

- Application services can be tested without network access or provisioned cloud resources.
- Local E2E runs avoid modifying Cognito, DynamoDB, S3, or real mailboxes.
- External-provider details are kept out of core workflow services where ports have been introduced.
- Production smoke tests provide a separate check of real provider integrations.

### Negative

- The in-memory model can drift from production adapter behavior.
- The project must maintain both in-memory and production implementations.
- The in-memory runtime cannot validate IAM, SST resource links, AWS conditional-write semantics, Cognito behavior, Resend delivery, or S3 signing.
- Architecture boundaries are not applied uniformly across every feature, so contributors must preserve the intended separation deliberately.

## Evidence

- `src/features/auth/registration/service.ts:54-87` defines registration dependencies as repository, identity, and email ports.
- `src/features/auth/registration/server.ts:10-47` composes either in-memory adapters or Cognito, DynamoDB, and Resend implementations.
- `src/features/case-materials/storage.ts:28-59` defines the storage port and selects an in-memory or S3 adapter.
- `src/features/case-notifications/service.ts:31-74` defines email and repository ports for lifecycle notifications.
- `src/features/case-notifications/server.ts:12-33` composes in-memory or DynamoDB and Resend implementations.
- `src/features/teacher/cases/active-case-archive-scheduler.ts:22-63` defines scheduler, EventBridge, and no-op E2E implementations.
- `package.json:9,16-17` defines memory-mode development and E2E commands.
- `README.md:44-54` directs isolated local auth flows to the in-memory E2E harness.
- `tests/e2e/production-smoke.e2e.ts:35-147` separately exercises registration, Cognito-backed login, case publication with an attachment, completion, certificate download, and password reset against real infrastructure.
- Commit `234343a` introduced service selection for in-memory auth integration tests on 2026-07-01.
