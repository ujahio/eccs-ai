# PRD: e-Clinical Cases Solutions (ECCS)

## Problem Statement

Medical professionals need a streamlined, case-based learning platform to earn continuing education credits for medical license renewal. Existing solutions are fragmented and costly — expensive flights and events, not fit for global education/need, hospitals need to subsidize cost of travels and learning avenues and students lack a self-paced, credential-backed learning experience that adapts to their renewal cycle.

## Solution

ECCS is a SaaS platform where medical professionals subscribe to receive curated case studies, work through them step-by-step, earn CE credits, and download verifiable certificates — all while teachers retain full control over content quality and case cadence.

For v1, ECCS is a single-tenant platform with one teacher account/persona. The partner medical facility is the CE authority for certificate and marketing language, while ECCS is the delivery and recordkeeping platform.

## User Stories

### Public Unauthenticated User

1. As a prospective student, I want to visit a public home page, so that I can learn about ECCS's medical education offerings.
2. As a prospective student, I want to read faculty credentials on the public site, so that I can evaluate the platform's credibility.
3. As a prospective student, I want to watch a "How it Works" walkthrough, so that I understand the learning experience before registering.
4. As a prospective student, I want to register for an account with my full name, email, and password, then verify my email within 24 hours, so that I can access the platform.
5. As a returning verified user, I want to log in to my existing account, so that I can continue my learning.
6. As a returning user, I want to reset my password via email, so that I can regain access if I forget my credentials.

### Student Learner

7. As a student, I want to view a personalized dashboard upon login, so that I can see my active case, recent certificates, and account payment status at a glance.
8. As a student, I want to see a prominent active case banner on my dashboard, so that I know exactly what case is available and when it expires.
9. As a student, I want to see my last 3 earned certificates on the dashboard, so that I can quickly re-download them or navigate to my full certificate history.
10. As a student, I want to understand that case access will be offered through an annual subscription, so that I know the future access model.
11. As a student, I want clear subscription copy stating that the account will renew annually and can be cancelled at any time, so that renewal expectations are transparent.
12. [Deferred until payment provider research] As a student, I want to pay via credit card during checkout, so that I can activate my subscription immediately.
13. [Deferred until payment provider research] As a student, I want to manage my subscription from my profile, so that I can see my plan details, renewal date, and cancel if needed.
14. As a student, I want to view a "Coming soon" message on my dashboard when no active case exists, so that I know the platform is still active.
15. As a student, I want to receive an email when a new case is published, so that I don't miss it.
16. As a student, I want to read a case presentation with clinical scenario (that may include pertinent information like patient history, and lab results), so that I can understand the medical context.
17. As a student, I want to write a personal analysis (150–700 words) for each case, so that I can practice clinical reasoning.
18. As a student, I want my analysis to remain editable until I pass the CME quiz, so that I can refine my thinking after reviewing the model answer.
19. As a student, I want to submit my analysis and view the teacher's model answer side-by-side with my own, so that I can compare my clinical reasoning to an expert's.
20. As a student, I want to access teaching resources (lecture text, optional PDF and attachments), so that I can deepen my understanding of the case.
21. As a student, I want to take a CME quiz of 3–5 multiple-choice questions per case, so that I can demonstrate my understanding.
22. As a student, I must answer all quiz questions correctly to pass, so that I demonstrate full comprehension before earning credit.
23. As a student, if I fail the quiz 3 times, I want to be navigated back to the teaching resources to review, so that I can re-engage with the material before retrying.
24. As a student, I want unlimited quiz retries after review, so that I can learn at my own pace.
25. As a student, I want to receive a downloadable PDF certificate upon passing the quiz, so that I have proof of my CE credit.
26. As a student, I want my certificate to include my full name, case title, completion date, CE credit hours, ECCS branding, partner logo, and a unique certificate ID, so that it is accepted for license renewal.
27. As a student, I want certificates to remain downloadable from my account, so that I can produce them for licensing audits years later.
28. As a student, I want to view and download all my earned certificates from a dedicated page, so that I can manage my CE credit records.
29. As a student, I want to leave optional feedback (rating/comment) on a case after completion, so that I can share my experience with teachers.
30. As a student, I want to change my email address and verify the new one via a confirmation link before it takes effect, so that my account stays secure.
31. As a student, I want to change my full name in my profile, so that my account reflects my current name.
32. As a student, I want past certificates to show the name I had when I earned them, so that my CE credits remain traceable to that point in time.
33. As a student, I want to change my password, so that my account stays secure.
34. As a student, when I change my password, I want all other active sessions to be invalidated, so that old devices or compromised tokens can't access my account.
35. As a student, I want password reset requests to be rate-limited (max 5 per hour), so that my inbox isn't spammed.
36. As a student, I want password reset tokens to expire after 60 minutes, so that a stale link cannot be reused.
37. As a student, I want to log out securely, so that my account is protected on shared devices.
38. [Deferred until payment provider research] As a student, if my payment fails, I want to be blocked from progressing on the active case but still able to download past certificates and access my profile, so that I can resolve payment without losing earned credits.
39. [Deferred until payment provider research] As a student, I want my subscription to activate immediately after successful payment/checkout so that I can access cases right away.
40. As a student, if I open the same case in two browser tabs and pass the quiz on one, I want the other submission to be rejected, so that I don't receive duplicate certificates.
41. As a student, if the deadline passes while I am mid-quiz, I am immediately blocked from submitting the attempt, so that the published deadline is strictly enforced.

### Teacher Educator

50. As the single v1 teacher, I want my account to be bootstrapped with a temporary password, require first-login password change, and require verified email before dashboard access, so that teacher access is controlled.
51. As a teacher, I want to log in and see a dashboard with the active case and last archived cases, so that I can quickly see what's running and what's completed.
52. As a teacher, I want the dashboard to show the active case's title, publish date, deadline, student completion and feedback count, so that I can gauge engagement.
53. As a teacher, I want to click an active or archived case from the dashboard and view all students who completed it along with their personal analysis and case feedback, so that I can assess learning outcomes.
54. As a teacher, I want to view all my drafts and all archived cases, so that I can manage my full content library.
55. As a teacher, I want to create a new case through a section-based creation experience where I can freely navigate between sections, so that I can write content in any order.
56. As a teacher, I want to set a case title and description first, so that the case has an identity before I write content.
57. As a teacher, I want to write a case presentation, so that I can format clinical scenarios clearly.
58. As a teacher, I want to write a model answer, so that students can compare their response to the teachers model answer.
59. As a teacher, I want to upload Case Study resources in a fixed order: lecture text, the student deadline date, and optional PDF attachments, so that content and schedule are consistently structured for students.
60. As a teacher, I want to add 3–5 CME questions with 2–5 options each and mark the correct answer, so that I can assess student comprehension.
61. As a teacher, I want the CME question creation to add one question at a time with a visible counter, so that I know how many I've added.
62. As a teacher, I want to save my case as a draft after adding a Case Title, so that I can control when my work is persisted while every persisted draft has an identifiable record.
63. As a teacher, I want to see a draft save confirmation after each save, so that I know my work is stored.
64. As a teacher, I want to review all case content on a final step before publishing including confirming the deadline, so that I can confirm everything is correct and choose how long students have.
65. As a teacher, I want the deadline set as a calendar date (not a time) from the Case Study resources step and still editable in final review, so that I decide the student access window while authoring and confirm it before publish.
66. As a teacher, I don't want to be able to create a new published case when there is an active published case, so that only one case runs at a time.
67. As a teacher, I want to open a draft case and see the creation wizard pre-filled with all existing content, so that I can pick up where I left off.
68. As a teacher, I want to edit or delete draft cases from the "All Cases" page, so that I can maintain my content.
69. As a teacher, I cannot manually archive or change a case deadline once published, so that the student schedule remains predictable.
70. As a teacher, I want to change my email address and verify the new one before it takes effect, so that my account stays secure.
71. As a teacher, I want to change my full name in my profile, so that my account reflects my current name.
72. As a teacher, I want to change my password, so that my account stays secure
73. As a teacher, I want archived cases to remain accessible for viewing student data, so that I can reference past cohorts.

### Super Admin (ECCS Operations)

No super-admin UI is included in v1. Teacher setup is handled through bootstrap/manual operations outside the product.

## Implementation Decisions

### Case Lifecycle

- Teacher creates a draft record after entering a Case Title. After the title exists, all fields are saveable to server-side draft storage via explicit "Save Draft" button. No auto-save.
- Teacher case creation is section-based with free navigation (not strictly linear). Sections: title/description → case presentation → model answer → Case Study resources (lecture text → deadline date → optional PDFs) → CME questions → review & publish.
- Teacher authoring uses explicit "Save Draft" only. The UI must show dirty-state messaging and warn before navigation when unsaved changes exist.
- Drafts can be incomplete and saved after the Case Title minimum is met. Draft PDF attachments are retained with the draft content. Use partial section-level validation for author feedback, with full validation as the hard gate at publish.
- Draft deletion requires a confirmation dialog and then permanently deletes the draft. Deleting a draft also deletes its draft PDF attachments from storage.
- Published case content is immutable in v1. Teachers can edit drafts only. Once published, the case presentation, model answer, teaching resources, quiz, CE credit hours, and deadline are frozen.
- If a serious typo or clinical correction is discovered after publishing, handle it manually outside the product. Minor typos remain unchanged.
- Deadline is initially set in the Case Study resources step and confirmed or edited at review/publish as a calendar date. The case expires at 11:59 PM UAE time (`Asia/Dubai`) on that date.
- Deadline display uses UAE time as the source of truth, with a local browser-time equivalent where helpful.
- Publishing is immediate from the teacher action. There is no scheduled publishing in v1.
- Publishing creates exactly one "active" case. Disable publishing while another active case exists.
- At deadline, the case auto-archives and all student operations on that case stop immediately. There is no mid-quiz exception in v1.
- Case active/archive state is computed dynamically from `deadlineAt` for correctness, and a scheduled backend job also persists archive state for operational clarity.
- Students cannot access cases after the deadline unless they already earned a certificate. The only lasting student access is to their own certificates.
- Payments are deferred until payment provider research is complete. While payments are deferred, verified students can access active cases through a `canAccessCases` policy boundary. When payments are introduced, case access must require both verification and paid access.

### Teacher Dashboard

- Home dashboard shows: active case stats + recent archived cases (limited to most recent).
- Separate "View All Cases" page lists all drafts (with edit/delete) and all archived cases (read-only student data).
- Clicking an active or archived case shows a student list with columns: student name, analysis submitted, certificate earned, feedback left.
- Clicking a draft case opens the creation wizard pre-filled with all existing content.
- V1 has a single teacher account/persona. Teacher screens can assume one teacher-owned content library and do not need multi-teacher ownership boundaries.
- Teachers can see student names attached to analyses, completion, certificates, and feedback for case review.
- Teachers see only the final locked student analysis in v1. Store key timestamps such as `analysisSubmittedAt` and `analysisLockedAt`, but do not store revision history.
- Teacher completion data is view-only in-app for v1. No export feature.

### Student Case Flow (Sequential, Gated)

1. **Case Presentation** — Reading only. "Continue" button advances.
2. **Personal Analysis** — 150-word minimum and 700-word maximum enforced before advancing. Show live word count. Editable until quiz is passed.
3. **Side-by-side Comparison** — Student's analysis on the left, teacher's model answer on the right. "Edit My Analysis" button available. Student can edit their analysis after comparing; edits are saved until quiz is passed.
4. **Teaching Resources** — Lecture text, PDF attachments.
5. **CME Quiz** — 3–5 MCQs. Shuffle question order only; keep answer option order exactly as authored. Must score 100%. Failed attempts show pass/fail only, not per-question correctness. On 3rd fail: forced navigation to re-read case presentation, model answer, and resources, then retry. Unlimited retries while the case is active.
6. **Case Feedback** — The student is given invited to give the case study a rating (1–5) and comment section. The students can partake or skip to next page
7. **Certificate** — Certificate record is created when the quiz is passed. Analysis locks at pass time. Certificate preview is available for viewing from certificate data; PDF generation/download occurs only when the student requests it.

Quiz attempts must be completed in one sitting. Leaving before submitting does not count as a failed attempt, and the UI must warn students before exiting the CME questions without finishing.

If the browser closes after quiz pass but before the certificate screen, the certificate remains available from the certificates page. If the case deadline has passed by then, the previously active case appears archived and no case operations resume.

Uploaded case PDFs are viewable inline when supported by the browser and always downloadable. PDF access uses short-lived signed URLs.

Teacher-authored case content uses Markdown in v1. PDF attachments cover richer supplemental material.

Feedback is optional and skippable. Passing the quiz earns the certificate; feedback does not gate certificate access.

Feedback is shown to the teacher with the student's name in v1.

### Profile and Account Security

**Registration verification flow:**

1. Student registers with full name, email, and password.
2. The system creates a pending, unverified registration and sends a verification link.
3. Verification links expire after 24 hours.
4. Login is blocked until verification succeeds, with short messaging that the user must verify their email before signing in.
5. After successful verification, the user is sent to login. No automatic session starts.
6. If the same email registers again while an active verification exists, do not create a duplicate account or registration. Treat the request as a rate-limited verification email resend.
7. Verification email resends are rate-limited to protect users from inbox spam. After the rate limit is reached, the user must wait for the 24-hour verification window to expire before they can attempt to register with that email again.
8. Expired, unverified pending registrations are deleted automatically by a scheduled cleanup job, which frees the email for a fresh registration attempt.

**Email change flow:**

1. User enters new email → system sends verification link to new email.
2. The current email remains the login email until the new email is verified.
3. Store `pendingEmail` and `pendingEmailVerificationExpiresAt`.
4. Email-change verification links expire after 24 hours.
5. After successful verification, switch identity to the new email and invalidate all other sessions, keeping the current session active where technically feasible.

**Password reset flow:**

1. User clicks "Forgot password" → enters email
2. Rate limited: max 5 requests per email per hour
3. Email sent with reset link containing token, but not the user's email address.
4. User clicks the link → enters email, new password, and confirmation.
5. Server confirms the reset with the identity provider using the entered email and URL code.
6. Confirmation email sent: "Your password was changed."
7. Completing password reset invalidates all existing sessions. The user must log in again with the new password.

**Password change (while logged in):**

1. User enters current password + new password
2. Current password verified → password updated
3. Confirmation email sent: "Your password was changed."
4. Password change invalidates all other sessions while keeping the current session active.

**Name change:**

1. Profile name changes affect future use only.
2. Each certificate stores the student display name captured at completion and is not rewritten.

**Teacher account security:**

1. Teacher setup is bootstrapped outside the product.
2. The teacher account uses a temporary password that must be changed on first login.
3. Teacher email must be verified before teacher dashboard access.
4. Teacher profile/account security matches student flows: change name, change password, and change email with verification. Old email remains active until the new email is verified.

**Auth model:**

1. Cognito is the auth/user source of truth for identity, credentials, email verification, and login eligibility.
2. DynamoDB stores app profile, role mirror, registration workflow state, certificate facts, case progress, and teacher/student product records.
3. better-auth acts as the app auth integration layer and can bridge identity-provider login into product sessions; it does not replace cognito user management.
4. Use Cognito groups for coarse roles (`student`, `teacher`) and mirror effective role into DynamoDB profile records for app queries/display.
5. App workflow records support product behaviors such as pending-registration resend limits and cleanup, but they do not replace cognito as the authority for successful login.

### Edge Cases

- **Deadline passes mid-quiz:** Strict cutoff. Once the deadline passes, all student operations on the case stop immediately, including in-progress quiz attempts.
- **Multi-tab quiz submission:** Unique constraint on `certificates (student_id, case_id)` prevents duplicate certificate records.
- **Repeated pending registration:** A repeated registration attempt for an active pending email does not create another account. It may send another verification email only within rate limits. Once the rate limit is reached, the user must wait for the pending verification to expire (24 hours) before attempting to register with that email again.
- **Expired registration verification:** Expired, unverified pending registrations are cleaned up automatically. A new registration with the same email can start only after the previous pending verification expires or is cleaned up — hitting the resend rate limit does not reset the 24-hour verification window.

### Certificates

- Certificate records are created at quiz pass time.
- Certificate records include certificate-facing immutable facts only: student display name, case title, completion date, CE credit hours, ECCS branding fields, partner/issuing authority fields, and unique certificate ID.
- Personal analysis remains in the case progress/completion record, not the certificate record.
- Certificate PDFs are generated on demand only when the student clicks download.
- PDF generation uses the current certificate template with immutable certificate facts.
- The app shows a visual certificate preview from the certificate record.
- Certificates are viewable and downloadable only by the owning student after login. No public certificate verification page in v1.
- Certificate access requires the student account to exist. No self-service account deletion in v1.

### Payments and Subscription

- Payment provider selection and integration are deferred for further research.
- Do not build interim manual subscription activation controls.
- Public site may mention annual subscription access at a high level, including future annual renewal and cancellation expectations.
- Do not name price, provider, checkout mechanics, or billing-management specifics until payment research is complete.
- Once payments are introduced, case access, new-case emails, and reminder emails must require both verified email and paid access.

### Email Notifications

- Authentication emails are in scope for v1: registration verification, email-change verification, password reset, and password/password-change confirmations.
- Case publication emails send when a new case is published.
- Deadline reminder emails send 48 hours before the deadline.
- While payments are deferred, case publication and reminder emails go to verified students.
- When payments are introduced, case publication and reminder emails must go only to verified paid students who have not yet earned the active case certificate for reminders.

### Public Site

- Use a static "How it Works" walkthrough in v1. No video hosting or embed requirement yet.
- Include faculty credibility content.
- Public marketing and certificates should treat the partner medical facility as the CE authority and ECCS as the delivery/recordkeeping platform.

### Responsiveness

- The full student case flow must be responsive in v1.
- Teacher authoring can be desktop-optimized but should remain usable on tablet.

## Testing Decisions

### Testing Philosophy

Tests verify external behavior, not implementation details. A test should break only when a user-facing behavior changes, not when code is refactored.

### What to Test

#### Smoke tests with real infrastructure

- **Case workflow** — walk through the full student flow (presentation → analysis → model answer → quiz → certificate). Verifies state transitions, word count validation, quiz pass/fail branching, and the 3-fail review redirect.
- **Password reset** — test Cognito forgot-password and confirm-password behavior, Resend custom email delivery, reset links containing the Cognito code but not the user's email address, old-password rejection after reset, confirmation email delivery, and session invalidation after password change.
- **Email change** — test that new email is not applied until verification is successful.
- **Registration verification** — test active pending registration blocks duplicate registration, expired pending registrations are cleaned up, login is blocked before verification, and verification sends the user to login.
- **Deadline cutoff** — test that a case becomes inaccessible to students immediately after the UAE deadline, including blocking in-progress quiz submission.
- **Certificate issuance** — test certificate record creation at quiz pass, analysis locking, visual preview availability, and PDF generation only on explicit download request.

#### Integration tests

- write tests using mocks as necesary to test userflows

#### Unit tests

- unit test ever module

#### Test Driven Devlopment

- Do not write implementation details without tests

## Out of Scope

- Self-service tenant/parent registration and management (v2)
- Teacher → student direct feedback (does not exist in the model)
- Medical license number collection or verification
- Discount/coupon marketing system
- Per-case or per-credit pricing (subscription only in v1)
- Invoice/billing for companies (credit card only in v1)
- Mobile native apps (responsive web only in v1)
- Video transcoding / streaming platform (v2 — direct S3 streaming in v1)
- Analytics dashboard for partner hospitals (teacher provides reports on request)
- Bulk student import via CSV (v2)
- Two-factor authentication (v2)

## Further Notes

- The platform is served in conjunction with a qualified medical facility (partner), but the partner has no operational role in the app for v1.
- Students always have the same base experience. Partner-specific discount is an infra capability that is not marketed in v1.
- The phrase "CE credits" is used generically in this PRD. The actual accreditation name may differ per region — this should be configurable per tenant in the future.
- Active case and published cases are used interchangeably
