# ADR 0003: Use Cognito-backed identities with Better Auth sessions

- **Status:** Accepted (retrospectively documented)
- **Decision date:** 2026-07-02
- **Recorded date:** 2026-09-15

## Context

ECCS requires verified-email registration, password reset, first-login password changes for the teacher, coarse student and teacher roles, and application sessions that integrate with Next.js. The implementation divides those responsibilities among Amazon Cognito, DynamoDB, and Better Auth.

The product requirements explicitly identify Cognito as the authority for identity, credentials, email verification, and login eligibility. DynamoDB stores application profiles and mirrors the effective role. Better Auth bridges successful Cognito authentication into an application session without replacing Cognito user management.

The repository records the responsibility split but does not preserve a comparison with alternative identity or session architectures. The original provider-selection rationale is therefore unknown beyond the documented requirements and implementation.

## Decision

Use Cognito-backed identities with Better Auth application sessions:

- Treat Cognito as the source of truth for credentials, email verification, login eligibility, and the `student` and `teacher` groups.
- Store the application profile and mirrored effective role in DynamoDB.
- Authenticate credentials through Cognito and verify the returned Cognito ID token before creating an application session.
- Require the verified token email, Cognito group-derived role, and DynamoDB profile to agree; fail authentication when they do not.
- Create the application session through a custom Better Auth plugin exposed by the App Router auth endpoint.
- Use a stateless JWE cookie session with an eight-hour fixed lifetime and no session refresh.
- Recheck the application profile, explicit session invalidation state, and Cognito login eligibility when loading an application session.

## Alternatives considered

No reliable repository evidence records which alternatives were evaluated or rejected. It is not known whether Cognito-only sessions, Better Auth-managed identities, or another identity provider were formally considered.

## Consequences

### Positive

- Cognito retains responsibility for credentials and account eligibility.
- Better Auth provides a Next.js-compatible application-session boundary.
- Authentication fails closed when the Cognito identity, Cognito group, and DynamoDB profile disagree.
- Student and teacher authorization can use one application role model after sign-in.
- Fixed-lifetime, HTTP-only, same-site cookies limit session persistence and client-side access.

### Negative

- Identity and authorization state is distributed across Cognito, DynamoDB, and the Better Auth session.
- Role, email, and account-state changes must keep those representations synchronized.
- The project owns a custom Cognito-to-Better-Auth bridge and token-verification path.
- Non-refreshing sessions require users to authenticate again after the fixed lifetime.
- Session invalidation requires application-profile state in addition to Cognito operations.

## Evidence

- `PRD.md:150-206` defines the registration, profile-security, Cognito, DynamoDB, Better Auth, and role-mirroring responsibilities.
- `infra/auth.ts:45-114` defines the email-based Cognito user pool, user-pool client, and student and teacher groups.
- `src/lib/auth/auth.ts:28-63` configures Better Auth, the Cognito session bridge, the eight-hour session, JWE cookie cache, and secure cookie behavior.
- `src/lib/auth/cognito-session-bridge.ts:256-323` verifies the Cognito token, verified email, group-derived role, and DynamoDB profile before creating the Better Auth session.
- `src/lib/auth/session.ts:48-77` reloads the application profile, applies session invalidation, and checks Cognito login eligibility.
- `src/app/api/auth/[...all]/route.ts:1-7` exposes the Better Auth handler through the Next.js App Router.
- Commit `87385c4` added the Cognito-backed Better Auth session bridge and stateless cookie sessions on 2026-07-02.
- Commit `1729a27` changed the role implementation to direct Cognito user groups on 2026-07-03.
