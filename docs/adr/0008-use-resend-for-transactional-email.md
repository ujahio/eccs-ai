# ADR 0008: Use Resend for transactional email

- **Status:** Accepted (retrospectively documented)
- **Decision date:** 2026-07-01
- **Recorded date:** 2026-09-15

## Context

ECCS sends transactional authentication and case-lifecycle email, including registration verification, email-change verification, password reset and change confirmations, case publication notices, and deadline reminders. The original repository plan used AWS SES for production delivery and MailSurp for test email flows. During the first registration implementation, that provider design was replaced.

The repository does not record why Resend was selected over the original providers. This ADR records the implemented decision without reconstructing an unsupported rationale.

## Decision

Use Resend as the application transactional-email provider. Store the API key as an SST secret, configure a verified sender per deployed environment, and keep email delivery behind application interfaces so services depend on email capabilities rather than directly on the Resend SDK.

Use the isolated in-memory email adapter for local Playwright flows. Use real Resend delivery only in deployed real-infrastructure smoke tests and deployed application stages.

Treat a Resend API error response as a failed send and surface it to the calling workflow rather than recording the operation as successful.

## Alternatives considered

- **AWS SES for production plus MailSurp for testing:** This was the original documented and partially implemented approach. It was replaced by the Resend migration.
- No other provider comparison or selection rationale is recorded.

## Consequences

- Deployed stages require `RESEND_API_KEY` and a verified `ECCS_EMAIL_SENDER` configuration.
- Resend becomes an external runtime dependency for transactional delivery and real-infrastructure smoke tests.
- SST manages the provider credential as a linked secret, but does not provision the external Resend account, domain, or sender verification.
- Application email interfaces preserve testability and limit provider-specific code to the delivery adapter.
- Local Playwright tests do not require external email delivery; they observe messages through the in-memory harness.
- Delivery failures are visible to application workflows, while retry policy remains a separate concern.

## Evidence

- Commit `81c8c2f2e873d0e93ab195f3d26ec58dcc0cee88` (2026-06-29), `first phase infra addition + project setup`, documented and scaffolded the earlier SES and MailSurp design.
- Commit `a9e738cc7ba8be54c03c104c05bc4dd4fe70f151` (2026-07-01), `Implement student registration verification`, introduced the transactional email interface and initial delivery adapter.
- Commit `3a7da2fbaddebb7b0bf5ef2c89763a59a3d2cd7f` (2026-07-01), `resend migration`, removed the SES SDK and SST email resource, added the Resend SDK and SST secret, and replaced the delivery adapter.
- Commit `ef71b5cf960e8673550dfdcf82d50d8250dac289` (2026-07-02), `Fix registration auth review findings`, updated the repository instructions and README to describe Resend and the isolated local E2E harness.
- Commits `7228658` (2026-07-09), `fix: surface resend email errors`, and `f0424f8` (2026-07-09), `Fix case reminder email delivery`, establish failure handling for Resend responses.
- `src/lib/aws/email.ts` contains the Resend delivery adapter; `infra/secrets.ts` and `infra/nextjs-client.ts` link its credential to the application.
- `README.md`, `.env.sample`, and `docs/deployment-promotion.md` document stage configuration and real-infrastructure smoke usage.
