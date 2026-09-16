# ADR 0007: Use deadline-derived case availability with scheduled archival

- **Status:** Accepted (retrospectively documented)
- **Decision date:** 2026-07-08
- **Recorded date:** 2026-09-15

## Context

Published cases have a UAE-calendar deadline. At that deadline, student operations must stop immediately, including an in-progress quiz submission. A delayed or failed background update must therefore not leave an expired case available. The system also benefits from a persisted archived state for operational queries and teacher-facing history.

## Decision

Determine whether a published case is active or archived from its `deadlineAt` value at read and authorization time. Treat the deadline calculation as the correctness boundary for case availability.

When a case is published, create an EventBridge Scheduler one-time schedule for its deadline. The schedule invokes a Lambda function that conditionally changes the matching published case to `archived` and sets `archivedAt` to the deadline. The conditional update includes both the case ID and deadline so that a stale schedule cannot archive a case whose deadline has changed. An already archived case or a stale event is a harmless no-op.

The scheduled update is an operational projection of the deadline-derived state; it is not the source of truth for whether students may continue using the case.

## Alternatives considered

No explicit alternatives analysis was recorded. The documented design combines dynamic deadline evaluation with scheduled persistence rather than relying on persisted lifecycle state alone.

## Consequences

- Student access stops at the deadline even if the scheduler is late or unavailable.
- Persisted lifecycle state can lag without weakening the access rule.
- Teacher and operational queries can use an explicit archived lifecycle and `archivedAt` value after the scheduled update succeeds.
- Publishing must provision a schedule, and the application needs permission to create or update that schedule and pass its invocation role.
- Archive handling must remain idempotent and reject stale schedule payloads.
- Local in-memory E2E mode uses a no-op scheduler, so production scheduler behavior requires focused unit coverage and real-infrastructure validation.

## Evidence

- Commit `ba7e1bc8` (2026-07-08), `docs: clarify published case deadline lifecycle`, added the PRD rules that deadline-derived state is used for correctness and a scheduled job persists archival state for operational clarity.
- Commit `672dc09` (2026-07-08), `refactor: separate case record type from lifecycle`, introduced the deadline-aware lifecycle helpers now represented in `src/features/teacher/cases/case-lifecycle.ts`.
- Commit `dfe7905c37b364211f8fde93d7858ce7d3515e58` (2026-07-15), `Implement active case archive scheduler`, added the EventBridge Scheduler adapter, archive Lambda, IAM resources, and conditional DynamoDB update.
- `PRD.md`, Case Lifecycle and Edge Cases, defines the immediate deadline cutoff, deadline-derived correctness, and persisted archival state.
- `src/features/teacher/cases/case-lifecycle.ts` computes active and archived behavior from `deadlineAt`.
- `src/features/teacher/cases/active-case-archive-scheduler.ts`, `src/features/teacher/cases/archive-active-case.ts`, and `infra/case-archive.ts` implement the scheduled projection and stale-event guard.
