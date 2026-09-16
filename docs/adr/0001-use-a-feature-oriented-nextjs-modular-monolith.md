# ADR 0001: Use a feature-oriented Next.js modular monolith

- **Status:** Accepted (retrospectively documented)
- **Decision date:** 2026-06-29
- **Recorded date:** 2026-09-15

## Context

ECCS v1 is a single-tenant product with one teacher persona and no super-admin UI. The current implementation is one full-stack Next.js App Router application containing the public site, student experience, teacher experience, HTTP entry points, and application services.

The source is organized around product features such as authentication, student cases, teacher case authoring, case materials, and notifications. Public, student, and teacher pages are separated with App Router route groups, and the student and teacher layouts enforce their respective role requirements.

The repository does not explicitly name this architecture a modular monolith or preserve a comparison with other architectural styles. The rationale beyond the v1 product scope is therefore unknown.

## Decision

Implement ECCS as a feature-oriented Next.js modular monolith:

- Deploy the UI, route handlers, server actions, and application services as one application.
- Organize business behavior under domain-oriented `src/features/*` modules.
- Use App Router route groups to separate public, student, and teacher experiences.
- Enforce student and teacher authorization in their shared route-group layouts.
- Keep route handlers and server actions thin by delegating business behavior to feature modules.

## Alternatives considered

No reliable repository evidence records which alternatives were evaluated or rejected. In particular, there is no evidence sufficient to claim that microservices, separately deployed frontends and APIs, or another framework were formally considered.

## Consequences

### Positive

- The application has one deployment unit and one codebase for UI and server behavior.
- Authentication and authorization can be shared across page, action, and route-handler boundaries.
- Feature-oriented modules provide internal boundaries without requiring distributed-system infrastructure.
- Student and teacher route layouts centralize role protection for their respective interfaces.

### Negative

- Features cannot be deployed or scaled independently.
- A failure in the shared deployment can affect multiple product areas.
- Feature boundaries depend on code organization and review rather than network or deployment isolation.
- Layering is pragmatic rather than uniform: some features use explicit services and repository ports, while others colocate application behavior and DynamoDB implementations.

## Evidence

- `PRD.md:11` defines v1 as a single-tenant platform with one teacher persona.
- `PRD.md:89-91` excludes a super-admin UI and keeps teacher setup outside the product.
- `PRD.md:121` permits teacher screens to assume one teacher-owned content library.
- `package.json:24-42` places Next.js, React, Better Auth, AWS clients, Resend, and SST in one application package.
- `src/app/(student)/student/layout.tsx:8-16` protects the student route group with `requireStudentSession`.
- `src/app/(teacher)/teacher/layout.tsx:7-15` protects the teacher route group with `requireTeacherSession`.
- `src/app/api/teacher/case-publish/route.ts:13-29` delegates an App Router endpoint to the teacher case publishing feature.
- `src/features/auth/registration/actions.ts:1-18` delegates a server action to the registration service.
- Commit `81c8c2f` created the initial Next.js and SST application scaffold on 2026-06-29.
