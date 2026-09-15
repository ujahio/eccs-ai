# ADR 0005: Store Case Materials in Private, Versioned S3

- **Status:** Accepted (retrospectively documented)
- **Decision date:** 2026-07-11
- **Recorded date:** 2026-09-15

## Context

Teacher-authored cases can include PDF attachments. Draft attachments must remain available with saved draft content, and deleting a draft must also delete its attachments. Students need access to published case materials, while v1 intentionally excludes a dedicated video transcoding or streaming platform.

Binary case materials need storage separate from DynamoDB application records. Transport must be encrypted, and access must remain mediated by application authorization rather than exposing bucket objects publicly. The application also needs to support intentional inline viewing and file download behavior without trusting arbitrary response headers from a caller.

This record was reconstructed after implementation. The repository confirms S3, versioning, application linking, and a policy that denies insecure transport. It does not document the original comparison of object-storage alternatives or the complete historical rationale for enabling versioning.

## Decision

Store case-material objects in an SST-managed S3 bucket linked to the ECCS Next.js application.

Keep the bucket private to application-mediated access; no public website or public access configuration is defined. Require an authenticated student session and confirm that the requested attachment belongs to an active student case before granting access. Protect the application attachment route with a signed, expiring URL, then redirect an authorized request to an S3 presigned read URL that expires after five minutes.

Allow only `inline` or `attachment` content disposition. Generate the final `Content-Disposition` response override from the validated disposition and a sanitized attachment filename, and force the response content type to `application/pdf`.

Enable S3 object versioning. Deny all bucket and object operations made without secure transport. Keep object lifecycle operations coordinated with case draft and publication behavior so deleting a draft also deletes its associated draft attachments.

Use direct S3-backed delivery for v1 rather than introducing a separate media transcoding or streaming platform.

## Alternatives considered

- A dedicated video transcoding or streaming platform is explicitly deferred to v2; direct S3 delivery is the recorded v1 choice.
- Storing attachment bytes in DynamoDB is not documented as considered; the historical evaluation is unknown.
- Other object storage providers, a public bucket, and a CDN-specific design are not documented as considered; their historical evaluation is unknown.
- The specific historical reason for enabling versioning, beyond recoverability implied by preserving object versions, is unknown.

## Consequences

### Positive

- Binary materials are separated from application records and stored in a managed object store.
- Versioning preserves prior object versions when an object is replaced or deleted.
- The explicit bucket policy rejects non-TLS transport.
- Authentication and active-case lookup occur before S3 access is granted.
- Five-minute S3 presigned URLs limit the useful lifetime of leaked final storage URLs.
- Controlled content disposition supports both viewing and downloading while sanitizing the filename and preserving the PDF content type.
- SST resource linking supplies the bucket binding to the application without duplicating the deployed bucket name.
- Direct S3-backed delivery keeps the v1 media architecture small.

### Negative

- Versioned objects can continue consuming storage after replacement or deletion unless lifecycle rules remove old versions.
- Application record deletion and S3 object deletion are not a single atomic transaction and require consistency handling.
- Direct S3-backed delivery does not provide a dedicated transcoding, adaptive streaming, or media processing pipeline.
- Access control and object-key handling remain application responsibilities.
- The two-step application URL and S3 presigned URL flow adds redirect and signature-validation complexity.
- A presigned S3 URL remains usable until its five-minute expiry even if the application session ends immediately after issuance.

## Evidence

- `PRD.md:97-102` requires server-side draft storage, retained draft PDF attachments, and attachment deletion when a draft is deleted.
- `PRD.md:292` defers video transcoding and streaming to v2 and records direct S3 streaming for v1.
- `infra/case-materials.ts:1-23` defines an SST S3 bucket with versioning and a bucket policy denying insecure transport for the bucket and its objects.
- `infra/nextjs-client.ts:33` links the case-material bucket to the deployed Next.js application.
- `src/app/(student)/student/cases/[caseId]/attachments/[attachmentId]/route.ts:19-80` requires a student session, validates the disposition and signed application URL, confirms the active-case attachment, and redirects to the presigned storage URL.
- `src/features/case-materials/storage.ts:50,217-278` sets the S3 read URL lifetime to five minutes and signs a `GetObject` request with a sanitized filename, controlled content disposition, and PDF content type.
- `src/features/student/cases/student-case.ts:356-367` resolves only an attachment belonging to an active case before storage access is issued.
- `sst.config.ts:12` loads the case-material infrastructure component.
- Commit `3fdb7e1` (2026-07-11), `Store case materials in S3`, introduced the bucket and application storage integration.
