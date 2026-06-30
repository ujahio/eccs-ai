# ECCS Implementation Plan

Use this as a phased checklist for implementing ECCS v1. Each phase should be independently shippable or reviewable before moving to the next.

## Phase 0: Project Baseline

- [x] Confirm local stage name and environment conventions.
- [x] Confirm Bun commands for dev, lint, typecheck, tests, and build.
- [x] Confirm SST Ion app structure and AWS account/stage setup.
- [x] Confirm `DESIGN.md` is the source of truth for UI components/pages.
- [x] Set up baseline CI-quality commands locally with Bun.
- [x] Add environment variable documentation for local development.

## Phase 1: Infrastructure Foundation

- [ ] Define SST Ion resources only; do not introduce other IaC tools.
- [ ] Create Cognito user pool/client for auth.
- [ ] Define Cognito groups: `student` and `teacher`.
- [ ] Create DynamoDB tables for app profile, verification state, cases, case progress, certificates, feedback, and scheduled jobs.
- [ ] Create S3 bucket for case PDF attachments.
- [ ] Configure S3 access through short-lived signed URLs.
- [ ] Configure SES for production email.
- [ ] Configure MailSurp for testing email flows.
- [ ] Add scheduled cleanup job for expired unverified registrations.
- [ ] Add scheduled archive job for cases past deadline.

## Phase 2: Auth And Account Model

- [ ] Use Cognito as the source of truth for users.
- [ ] Use DynamoDB for profile, role mirror, verification workflow state, and app records.
- [ ] Integrate better-auth where useful as the app auth integration layer.
- [ ] Implement student registration with full name, email, password.
- [ ] Create pending unverified registration records.
- [ ] Send registration verification email.
- [ ] Expire registration verification links after 24 hours.
- [ ] Block login until registration verification succeeds.
- [ ] If active pending registration exists for an email, block duplicate registration and show verification-already-sent notice.
- [ ] Delete expired unverified registrations with scheduled cleanup.
- [ ] After verification, send user to login without starting a session.
- [ ] Implement password reset with max 3 requests per email per hour.
- [ ] Expire password reset tokens after 15 minutes.
- [ ] Make password reset tokens single-use.
- [ ] Invalidate all sessions after password reset completes.
- [ ] Implement password change while logged in.
- [ ] Invalidate all other sessions after password change, keeping current session active.
- [ ] Implement profile name change.
- [ ] Implement email change with `pendingEmail` and `pendingEmailVerificationExpiresAt`.
- [ ] Keep old email active until new email verification succeeds.
- [ ] Expire email-change verification links after 24 hours.
- [ ] Invalidate other sessions after verified email change.

## Phase 3: Teacher Bootstrap And Teacher Account

- [ ] Bootstrap the single v1 teacher account outside the product UI.
- [ ] Assign teacher to Cognito `teacher` group.
- [ ] Require temporary password change on first login.
- [ ] Require verified teacher email before teacher dashboard access.
- [ ] Support teacher profile name change.
- [ ] Support teacher password change.
- [ ] Support teacher email change with verification.
- [ ] Do not build teacher invite/deactivate UI in v1.
- [ ] Do not build super-admin UI in v1.

## Phase 4: Public Site

- [ ] Build public home page following `DESIGN.md`.
- [ ] Present ECCS as delivery and recordkeeping platform.
- [ ] Present partner medical facility as CE authority in marketing/certificate language.
- [ ] Add faculty credibility content.
- [ ] Add static "How it Works" walkthrough.
- [ ] Include high-level annual subscription messaging.
- [ ] State future annual renewal and cancellation expectations.
- [ ] Avoid price, provider, checkout, and billing-management specifics until payment research is complete.
- [ ] Make public pages responsive.

## Phase 5: Teacher Case Authoring

- [ ] Build teacher dashboard with active case stats and recent archived cases.
- [ ] Build "View All Cases" page with drafts and archived cases.
- [ ] Implement section-based case wizard with free navigation.
- [ ] Sections: title/description, case presentation, model answer, teaching resources, CME questions, review/publish.
- [ ] Use Markdown for teacher-authored content.
- [ ] Add optional PDF attachments for teaching resources.
- [ ] Allow browser inline PDF viewing when supported.
- [ ] Always provide PDF download.
- [ ] Use signed URLs for PDF viewing/download.
- [ ] Use explicit "Save Draft" only; no autosave.
- [ ] Add dirty-state messaging.
- [ ] Warn before navigating away with unsaved changes.
- [ ] Allow incomplete drafts to save.
- [ ] Add partial section-level validation for author feedback.
- [ ] Enforce full validation at publish.
- [ ] Require 3-5 CME questions.
- [ ] Require 2-5 options per CME question.
- [ ] Require one correct answer per question.
- [ ] Preserve answer option order exactly as authored.
- [ ] Add visible CME question counter.
- [ ] Add draft delete confirmation dialog.
- [ ] Permanently delete confirmed drafts.
- [ ] Delete draft PDF attachments from storage when draft is deleted.

## Phase 6: Case Publishing And Lifecycle

- [ ] Publish immediately from teacher action; no scheduled publishing in v1.
- [ ] Block publishing when an active case already exists.
- [ ] Set deadline as a calendar date at review/publish.
- [ ] Convert deadline to 11:59 PM UAE time (`Asia/Dubai`) on selected date.
- [ ] Display UAE deadline as source of truth.
- [ ] Show local browser-time equivalent where helpful.
- [ ] Make published cases immutable.
- [ ] Do not allow in-app correction/editing after publish.
- [ ] Handle serious published-case corrections manually outside product.
- [ ] Compute active/archive status dynamically from `deadlineAt`.
- [ ] Persist archive state through scheduled backend job.
- [ ] At deadline, immediately stop all student operations on the case.
- [ ] Do not allow mid-quiz exception in v1.
- [ ] Preserve archived cases and attachments for teacher viewing.

## Phase 7: Student Dashboard And Access

- [ ] Require verified login for dashboard access.
- [ ] Implement `canAccessCases` policy boundary.
- [ ] While payments are deferred, allow verified students to access active cases.
- [ ] Add implementation note: future access requires verified and paid.
- [ ] Show active case banner when active case exists.
- [ ] Show "Your next case is coming soon" when no active case exists.
- [ ] Show latest 3 earned certificates on dashboard.
- [ ] Link to full certificate history.
- [ ] After deadline, show previous case as archived and remove student operations.
- [ ] Keep certificates accessible through student account login.
- [ ] Do not build self-service account deletion in v1.

## Phase 8: Student Case Flow

- [ ] Implement sequential gated flow.
- [ ] Step 1: Case presentation read-only.
- [ ] Step 2: Personal analysis.
- [ ] Enforce 150-word minimum.
- [ ] Enforce 700-word maximum.
- [ ] Show live word count.
- [ ] Step 3: Side-by-side comparison with student analysis and model answer.
- [ ] Allow editing analysis after model answer.
- [ ] Step 4: Teaching resources with lecture text and PDFs.
- [ ] Step 5: CME quiz.
- [ ] Shuffle question order only.
- [ ] Keep answer option order as authored.
- [ ] Require 100% score to pass.
- [ ] Show pass/fail only on failed attempts.
- [ ] Do not reveal which answers were wrong.
- [ ] After 3 failed attempts, force review before retry.
- [ ] Allow unlimited retries while case remains active.
- [ ] Make quiz attempts one sitting only.
- [ ] Warn students before exiting unfinished CME questions.
- [ ] Do not count abandoned unsubmitted quiz as failed attempt.
- [ ] Step 6: Optional feedback with rating and comment.
- [ ] Include clear skip action.
- [ ] Step 7: Certificate preview and download action.
- [ ] Make full student flow responsive.

## Phase 9: Certificate System

- [ ] Create certificate record immediately when quiz is passed.
- [ ] Lock analysis at quiz pass time.
- [ ] Prevent duplicate certificates with unique student/case constraint.
- [ ] Store immutable certificate-facing facts only.
- [ ] Include student display name captured at completion.
- [ ] Include case title.
- [ ] Include completion date.
- [ ] Include CE credit hours.
- [ ] Include ECCS branding fields.
- [ ] Include partner/issuing authority fields.
- [ ] Include unique certificate ID.
- [ ] Keep personal analysis in case progress/completion record, not certificate record.
- [ ] Show visual certificate preview from certificate record.
- [ ] Generate PDF only when student clicks download.
- [ ] Use current certificate template with immutable certificate facts.
- [ ] Require login for viewing/downloading certificates.
- [ ] Do not build public certificate verification in v1.
- [ ] Make certificate history page.

## Phase 10: Teacher Review Views

- [ ] Let teacher view active case details.
- [ ] Let teacher view archived case details.
- [ ] Show student list for active/archived case.
- [ ] Include student name.
- [ ] Include analysis submitted status.
- [ ] Include final locked analysis.
- [ ] Include certificate earned status.
- [ ] Include feedback left status.
- [ ] Show named feedback to teacher.
- [ ] Store `analysisSubmittedAt`.
- [ ] Store `analysisLockedAt`.
- [ ] Do not store or show analysis revision history.
- [ ] Do not build export in v1.

## Phase 11: Email Notifications

- [ ] Send registration verification emails.
- [ ] Send email-change verification emails.
- [ ] Send password reset emails.
- [ ] Send password changed confirmation emails.
- [ ] Send new-case publication email when a case is published.
- [ ] Send deadline reminder email 48 hours before deadline.
- [ ] While payments are deferred, send case emails to verified students.
- [ ] Add implementation note: when payments exist, send case emails only to verified paid students.
- [ ] For reminders after payments exist, send only to verified paid students who have not earned the active case certificate.

## Phase 12: Payment Placeholder

- [ ] Do not choose payment provider in v1 implementation.
- [ ] Do not build checkout.
- [ ] Do not build subscription management.
- [ ] Do not build interim manual subscription activation.
- [ ] Keep access checks behind `canAccessCases`.
- [ ] Add clear TODO/ADR for future payment provider research.
- [ ] Document future annual auto-renew subscription expectation.
- [ ] Document that students can cancel any time once payments are live.

## Phase 13: Testing

- [ ] Unit test every module with behavior-focused tests.
- [ ] Add integration tests for key user flows using mocks where needed.
- [ ] Add Playwright smoke test for full student case flow.
- [ ] Test presentation to analysis to comparison to resources to quiz to certificate.
- [ ] Test analysis 150-700 word validation.
- [ ] Test quiz pass/fail branching.
- [ ] Test 3-fail review redirect.
- [ ] Test abandoned quiz does not count as failed attempt.
- [ ] Test strict deadline cutoff blocks operations.
- [ ] Test deadline cutoff blocks in-progress quiz submission.
- [ ] Test duplicate quiz pass does not create duplicate certificate.
- [ ] Test certificate record creation at quiz pass.
- [ ] Test PDF is generated only on explicit download.
- [ ] Test registration verification duplicate active pending behavior.
- [ ] Test registration verification expiry and cleanup.
- [ ] Test login blocked before verification.
- [ ] Test email change does not apply until verification succeeds.
- [ ] Test password reset rate limiting.
- [ ] Test password reset token expiry.
- [ ] Test password reset token single-use behavior.
- [ ] Test session invalidation after password reset.
- [ ] Test session invalidation after password change.
- [ ] Run `bun` lint/typecheck/test/build commands after implementation phases.

## Phase 14: Launch Readiness

- [ ] Review public copy for partner-as-CE-authority language.
- [ ] Review certificate preview and PDF content.
- [ ] Review UAE deadline behavior manually.
- [ ] Review responsive student flow on mobile and desktop.
- [ ] Review teacher authoring on desktop and tablet.
- [ ] Confirm SES production sender/domain setup.
- [ ] Confirm MailSurp testing setup.
- [ ] Confirm scheduled jobs are enabled.
- [ ] Confirm bootstrap instructions for teacher account.
- [ ] Confirm payment-deferred messaging is not misleading.
- [ ] Confirm no super-admin UI or hidden seed routes exist.
- [ ] Run final lint/typecheck/test/build with Bun.
