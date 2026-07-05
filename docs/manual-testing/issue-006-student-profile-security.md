# Manual Test Plan: Issue 006 Student Profile Security

Use this checklist to manually verify student full-name changes, verified email changes, and logged-in password changes.

## Setup

- Start the app in local e2e memory mode or your normal local stage.
- Use a fresh student account unless a scenario says otherwise.
- Keep at least two browser sessions available for session-invalidation checks:
  - Session A: normal browser window.
  - Session B: incognito/private window or a second browser profile.
- Test selectors and route names assume the implemented UI:
  - Student dashboard: `/student`
  - Student profile/security: `/student/profile`
  - Login: `/login`
  - Register: `/register`

## Test Data

- Original student:
  - First name: `Jordan`
  - Last name: `Adebayo`
  - Email: use a unique address, for example `manual-006-<timestamp>@example.com`
  - Password: `casework1`
- Updated name:
  - First name: `Alex`
  - Last name: `Chen`
- New email:
  - Use a second unique address, for example `manual-006-new-<timestamp>@example.com`
- New password:
  - `newcase1`

## Flow 1: Baseline Student Registration And Access

1. Go to `/register`.
2. Register with the original student data.
3. Open the registration verification link from the local email/e2e harness.
4. Confirm you land on `/login?verification=verified`.
5. Sign in with the original email and `casework1`.
6. Confirm you land on `/student`.
7. Open the student-name dropdown in the top right.
8. Click `Profile`.
9. Confirm you land on `/student/profile`.

Expected:

- Student dashboard is protected before login.
- Verified student can access `/student/profile`.
- Profile page opens to the `Personal details` tab with the current verified email in the email field.

## Flow 2: Update Full Name

1. On `/student/profile`, select the `Personal details` tab if it is not already active.
2. Change first name to `Alex`.
3. Change last name to `Chen`.
4. Leave the email field as the current verified email.
5. Click `SAVE CHANGES`.

Expected:

- A success message says `Your name has been updated.`
- Refresh `/student/profile`.
- First name remains `Alex`.
- Last name remains `Chen`.
- Email remains unchanged.

Certificate traceability note:

- Existing certificates are not implemented in this slice, so manually verify there is no code path or UI that rewrites certificate records during this name change.

## Flow 3: Full Name Validation

1. On `/student/profile`, clear the first name.
2. Clear the last name.
3. Click `SAVE CHANGES`.

Expected:

- First name error says `Enter your first name.`
- Last name error says `Enter your last name.`
- No success message appears.
- Refreshing the page keeps the prior saved name.

## Flow 4: Request Email Change

1. On `/student/profile`, select the `Personal details` tab.
2. Confirm the email field contains the original email.
3. Enter the new email in the email field.
4. Click `SAVE CHANGES`.

Expected:

- Success message says `Check your new email address. The verification link expires in 24 hours.`
- A pending verification notice appears for the new email.
- Signing out and signing in with the original email still works.
- Signing in with the new email does not work yet.

## Flow 5: Saving Current Email Does Not Request Email Change

1. On `/student/profile`, enter the current verified email in the email field.
2. Click `SAVE CHANGES`.

Expected:

- No pending email-change notice appears.
- No email-change verification should be sent.
- Current login email remains unchanged.

## Flow 6: Invalid Email Rejection

1. On `/student/profile`, enter `not-an-email`.
2. Click `SAVE CHANGES`.

Expected:

- Inline email error says `Enter a valid email address.`
- No pending email appears.
- Current verified email remains unchanged.

## Flow 7: Duplicate Email Rejection

Prerequisite:

- Create and verify a second student account with another email.

Steps:

1. Sign in as the original student.
2. Go to `/student/profile`.
3. Enter the second student account email in the email field.
4. Click `SAVE CHANGES`.

Expected:

- Error message says `This email address is already in use.`
- Current verified email remains unchanged.
- No login identity changes occur.

## Flow 8: Verify Email Change

1. Complete Flow 4.
2. Open the email-change verification link sent to the new email.

Expected:

- You are redirected to `/login?emailChange=verified`.
- Login page says `Your email address has been updated. Please sign in.`
- Signing in with the original email fails.
- Signing in with the new email and old password succeeds.
- `/student/profile` now shows the new email in the email field.
- Pending email notice is gone.

## Flow 9: Email Change Link Expiration

This is easiest with a short TTL override or by manipulating the in-memory/profile record in local testing.

1. Request an email change.
2. Let or force `pendingEmailVerificationExpiresAt` to be in the past.
3. Open the email-change verification link.

Expected:

- You are redirected to `/login?emailChange=expired`.
- Login page says `This email change link has expired.`
- Original email still signs in.
- New email does not sign in.
- Student can request another email change later.

## Flow 10: Invalid Or Reused Email Change Link

Invalid link:

1. Open `/verify-email-change?token=not-a-real-token`.

Expected:

- You are redirected to `/login?emailChange=invalid`.
- Login page says `This email change link is invalid.`

Reused link:

1. Successfully verify an email change.
2. Open the same verification link again.

Expected:

- Link no longer changes account state.
- User is shown an invalid or already-used email-change message.
- Current verified email remains the new email.

## Flow 11: Email Change Invalidates Other Sessions

1. Register and verify a fresh student.
2. Sign in as the student in Session B first.
3. Sign in as the same student in Session A.
4. In Session A, request and verify an email change.
5. In Session B, navigate to `/student`.

Expected:

- Session B is redirected to `/login`.
- Session A is also required to sign in again after email verification.
- Only the new email can sign in after verification.

## Flow 12: Change Password Successfully

1. Sign in with the current verified email.
2. Go to `/student/profile`.
3. Select the `Password` tab.
4. Enter current password `casework1`.
5. Enter new password `newcase1`.
6. Confirm new password `newcase1`.
7. Click `SAVE CHANGES`.

Expected:

- Success message says `Your password was changed.`
- Password-changed confirmation email is sent.
- Current session remains usable.
- Refresh `/student/profile`; it still loads.
- Sign out.
- Sign in with old password fails.
- Sign in with new password succeeds.

## Flow 13: Password Change Requires Current Password

1. On `/student/profile`, select the `Password` tab.
2. Enter an incorrect current password.
3. Enter `newcase1` as new password and confirmation.
4. Click `SAVE CHANGES`.

Expected:

- Error says `Enter your current password.`
- Password is not changed.
- Old password still signs in.
- New password does not sign in.
- No password-changed confirmation email is sent.

## Flow 14: Password Validation

1. On `/student/profile`, select the `Password` tab.
2. Enter the correct current password.
3. Enter `short` as the new password.
4. Enter `different` as confirmation.
5. Click `SAVE CHANGES`.

Expected:

- New password error says `Password is missing: at least 8 characters, at least one number.`
- Confirm password error says `Passwords do not match.`
- Password is not changed.

## Flow 15: Password Reuse Rejection

1. On `/student/profile`, select the `Password` tab.
2. Enter the current password.
3. Enter the same current password as the new password.
4. Confirm with the same current password.
5. Click `SAVE CHANGES`.

Expected:

- Error says `Choose a new password that is different from the current one.`
- Password is not changed.

## Flow 16: Password Change Invalidates Other Sessions But Keeps Current Session

1. Sign in as the student in Session B first.
2. Sign in as the same student in Session A.
3. In Session A, go to `/student/profile`.
4. Change the password successfully.
5. In Session A, refresh `/student/profile`.
6. In Session B, navigate to `/student`.

Expected:

- Session A remains active.
- Session B is redirected to `/login`.
- Old password fails.
- New password succeeds.

## Flow 17: Header Navigation And Account Menu

1. Go to `/student`.
2. On desktop, confirm the logo appears on the left, `Dashboard` is active in the student nav, and the student's name appears at top right.
3. Confirm there is no separate account/profile item in the main nav.
4. Open the student-name dropdown in the top right.
5. Confirm the dropdown contains `Profile`, `Case studies`, and `Sign out`.
6. Click `Profile`.
7. Confirm you land on `/student/profile`.
8. Switch to a mobile viewport.
9. Confirm the logo remains visible and the top-right account trigger becomes a burger button.
10. Open the burger menu and confirm it contains `Dashboard`, `Certificates`, `Profile`, and `Sign out`.

Expected:

- Account/profile navigation is only exposed through the student-name dropdown.
- The header has no standalone sign-out button.
- Mobile navigation stays inside the burger menu rather than wrapping across the header.

## Flow 18: Mobile Layout Smoke Check

1. Open dev tools and switch to a mobile viewport.
2. Go to `/student/profile`.
3. Exercise the personal details and password tabs visually.

Expected:

- Fields stack cleanly.
- Buttons are usable and text does not overlap.
- Error and success messages remain readable.
- Nav and the student-name account dropdown are reachable.

## Closeout Checklist

- Full-name update works and survives refresh.
- Invalid name inputs are blocked.
- Email-change request stores pending state and sends a verification link.
- Current login email remains active until verification.
- New email cannot sign in before verification.
- Verified email change switches login identity to the new email.
- Expired/invalid/reused email-change links do not mutate identity.
- Email change invalidates other active sessions.
- Password change requires the current password.
- Password change sends confirmation email.
- Password change keeps the current session active.
- Password change invalidates other active sessions.
- Old password fails after password change.
- New password succeeds after password change.
