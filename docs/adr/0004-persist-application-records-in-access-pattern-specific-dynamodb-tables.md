# ADR 0004: Persist Application Records in Access-Pattern-Specific DynamoDB Tables

- **Status:** Accepted (retrospectively documented)
- **Decision date:** 2026-07-01
- **Recorded date:** 2026-09-15

## Context

ECCS needs persistent records for registration workflows, application profiles and mirrored roles, teacher-authored cases, student quiz attempts, case completions, and certificates. Cognito remains authoritative for identity, credentials, email verification, and login eligibility, so application records must not replace the identity provider.

The application queries these records through distinct product access patterns, including normalized email, verification token, registration status and expiry, effective role, case lifecycle and deadline, and student or case completion history.

This record was reconstructed after implementation. The repository explicitly assigns application records to DynamoDB and demonstrates separate tables and indexes, but it does not contain a historical comparison of database or DynamoDB modeling alternatives.

## Decision

Persist application and workflow records in separate SST-managed DynamoDB tables organized by product record type and its access patterns.

Use primary keys for stable record identity and add global secondary indexes for supported queries. Use DynamoDB TTL for ephemeral registration workflow data. Store the effective application role in profile records for product queries and display while retaining Cognito and Cognito groups as the authority for authentication and coarse role membership.

The current table boundaries are:

- Registration workflows
- User profiles
- Teacher cases
- Student certificates
- Student case completions
- Student quiz attempts

## Alternatives considered

- A DynamoDB single-table design is not documented as considered; the historical reason for choosing separate tables is unknown.
- Relational databases and other document or key-value databases are not documented as considered; their historical evaluation is unknown.
- Storing all user and role state only in Cognito is inconsistent with the recorded product requirement for queryable application profiles and workflow state, but the original trade-off analysis is unknown.

## Consequences

### Positive

- Each product record type has an independently understandable schema and access pattern.
- Global secondary indexes support the queries visible in the application without table scans.
- TTL supports eventual removal of expired registration workflow records.
- Serverless DynamoDB capacity and lifecycle remain managed through the same SST deployment model.
- Authentication authority remains separate from product and workflow persistence.

### Negative

- Cross-record joins and multi-record consistency must be implemented in application workflows.
- Effective role data is duplicated between Cognito groups and DynamoDB profiles and therefore requires synchronization rules.
- New query patterns may require new indexes and infrastructure deployment.
- Separate tables can increase the number of resources, policies, and repositories that must be maintained.

## Evidence

- `PRD.md:200-206` assigns identity authority to Cognito and application profiles, role mirrors, workflow state, certificates, progress, and product records to DynamoDB.
- `PRD.md:159-161` requires pending-registration deduplication, resend limits, expiry, and automatic cleanup.
- `infra/tables.ts:1-26` defines the registration workflow table, token and status/expiry indexes, and TTL.
- `infra/tables.ts:28-52` defines the profile table and indexes for email, role, and pending email verification tokens.
- `infra/tables.ts:54-136` defines case, certificate, completion, and quiz-attempt tables with lifecycle, student, case, and completion-time indexes.
- `infra/nextjs-client.ts:36-42` links the DynamoDB tables into the deployed Next.js application.
- Commit `b617a50` (2026-07-01), `update PRD`, recorded the Cognito/DynamoDB authority split.
- Commit `a9e738c` (2026-07-01), `Implement student registration verification`, introduced the initial registration workflow and profile tables. Later feature commits added tables and indexes for cases, certificates, completions, and quiz attempts.

