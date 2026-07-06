# Manual Test Plan: Issue 007 Teacher Bootstrap

Use this runbook to bootstrap the single v1 teacher account in the local SST stage and verify the first-login security flow.

## Safety Notes

- The script defaults to a dry run. Nothing is written to AWS until you add `--apply`.
- Do not pass the temporary password as a CLI argument. Use a local-only environment variable so the secret is not written into shell history or echoed in logs.
- The script refuses to continue if `UserProfileTable` already contains a conflicting profile record for the teacher email.
- The script refuses to continue if Cognito or `UserProfileTable` already has a teacher identity for a different email. V1 supports exactly one teacher account/persona.
- The bootstrap and cleanup scripts refuse to mutate an existing student account or a non-teacher app profile.
- Existing Cognito users are never promoted into teacher access. The script only creates a brand-new teacher account or reconciles an existing complete teacher identity.
- Run this only through SST shell so `Resource.AuthUserPool.id` and `Resource.UserProfileTable.name` resolve correctly.

## Required Inputs

- Teacher email address
- Teacher first name
- Teacher last name
- Temporary password in a local environment variable when you are:
  - creating a brand-new teacher user, or
  - resetting the temporary password for an existing complete teacher identity

Suggested local-only password entry:

```bash
read -s "TEACHER_TEMP_PASSWORD?Temporary password: "
export TEACHER_TEMP_PASSWORD
```

## Commands

Dry run:

```bash
bunx sst shell --stage ailocal -- bun scripts/bootstrap-teacher.ts \
  --email teacher@example.com \
  --first-name Taylor \
  --last-name Smith
```

Apply for a new teacher user:

```bash
bunx sst shell --stage ailocal -- bun scripts/bootstrap-teacher.ts \
  --email teacher@example.com \
  --first-name Taylor \
  --last-name Smith \
  --apply
```

Apply and force a fresh temporary password for an existing complete teacher identity:

```bash
bunx sst shell --stage ailocal -- bun scripts/bootstrap-teacher.ts \
  --email teacher@example.com \
  --first-name Taylor \
  --last-name Smith \
  --apply \
  --reset-temporary-password
```

Optional password variable override:

```bash
bunx sst shell --stage ailocal -- bun scripts/bootstrap-teacher.ts \
  --email teacher@example.com \
  --first-name Taylor \
  --last-name Smith \
  --apply \
  --password-env ECCS_TEACHER_BOOTSTRAP_PASSWORD
```

After the script completes, clear the temporary password from your shell:

```bash
unset TEACHER_TEMP_PASSWORD
```

## Expected Script Behavior

Dry run should:

- print whether the Cognito user already exists
- list whether it would create or reconcile Cognito attributes
- show whether it would add the `teacher` group
- show whether it would create or update the DynamoDB teacher profile
- refuse a different teacher email when a teacher identity already exists in Cognito or `UserProfileTable`
- refuse to promote any existing Cognito user that is not already a complete teacher identity
- remind you that `--apply` is required for writes

Apply mode should:

- create the Cognito user when missing with:
  - `email_verified=true`
  - `given_name`
  - `family_name`
  - `name`
- add the user to the Cognito `teacher` group
- create or update the `UserProfileTable` record with role `teacher`
- leave a password unchanged only when reconciling the already-complete teacher identity or when Cognito is already in `FORCE_CHANGE_PASSWORD`
- reset a temporary password for an existing complete teacher identity when `--reset-temporary-password` is supplied, causing the next sign-in to require `NEW_PASSWORD_REQUIRED`

## Expected First-Login Behavior

When a temporary password was set by the script:

1. Go to `/login`.
2. Sign in with the teacher email and the temporary password.
3. Cognito should require a first-login password change (`NEW_PASSWORD_REQUIRED` flow).
4. After setting the permanent password, sign in again if needed.
5. Confirm the teacher can reach `/teacher`.

When the script only reconciled the already-complete teacher identity without resetting the password:

- Sign in with the existing permanent password.
- Confirm `/teacher` is available and the teacher session works normally.

## Manual Checks

### Check 1: Dry Run Output

1. Run the dry-run command.
2. Confirm the plan matches the intended teacher identity.
3. Confirm no AWS changes are made.

Expected:

- The script prints `Dry run plan:`.
- The script exits successfully without creating or updating resources.

### Check 2: Bootstrap A New Teacher User

1. Export `TEACHER_TEMP_PASSWORD`.
2. Run the apply command for a teacher email that does not already exist.

Expected:

- The script reports Cognito user creation.
- The script reports the `teacher` group assignment.
- The script reports a DynamoDB profile upsert.
- The script never prints the temporary password value.

### Check 3: Re-Run Idempotently

1. Run the same apply command again without `--reset-temporary-password`.

Expected:

- The script reuses the existing Cognito user.
- The script keeps the existing password unchanged.
- The script does not create duplicate teacher profile records.
- The `teacher` group remains assigned.

### Check 4: Force A Fresh Temporary Password

1. Export a new `TEACHER_TEMP_PASSWORD`.
2. Re-run the apply command with `--reset-temporary-password`.

Expected:

- The script resets a temporary password.
- The next sign-in requires a password change again.
- The password value is not echoed by the script.

### Check 5: Refuse A Second Teacher Email

1. Bootstrap or identify an existing teacher identity for `teacher@example.com`.
2. Run the dry-run or apply command with a different email, such as `second-teacher@example.com`.

Expected:

- The script refuses to continue.
- The error states that v1 supports exactly one teacher account/persona.
- No Cognito or DynamoDB writes are made.

### Check 6: Refuse Existing User Promotion

1. Identify an existing Cognito user that is not already the complete teacher identity.
2. Run the dry-run or apply command for that email, with and without `--reset-temporary-password`.

Expected:

- The script refuses to continue.
- The error explains that bootstrap only creates a brand-new teacher account or reconciles an existing teacher account.
- `--reset-temporary-password` does not convert that existing user into a teacher.

### Check 7: Verify Cognito Attributes And Group

1. Sign in as the teacher after bootstrap.
2. Open the teacher-facing area.
3. Confirm the teacher display name matches the supplied first and last name.

Expected:

- Teacher login succeeds.
- The teacher reaches `/teacher`.
- The teacher account behaves as a verified teacher account.

### Check 8: Verify DynamoDB Profile

Use the AWS console or a local read-only inspection script to confirm the `UserProfileTable` row for the Cognito `sub`.

Expected profile fields:

- `profileId`: Cognito `sub`
- `emailNormalized`: lower-cased teacher email
- `firstName`: provided first name
- `lastName`: provided last name
- `fullName`: combined first and last name
- `role`: `teacher`
- `emailVerifiedAt`: present
- `createdAt`: present
- `updatedAt`: present

## Cleanup Notes

- For a single-account rollback, use the teacher cleanup script in dry-run mode first:

```bash
bunx sst shell --stage ailocal -- bun scripts/cleanup-teacher.ts \
  --email teacher@example.com
```

- Apply the rollback only after reviewing the plan:

```bash
bunx sst shell --stage ailocal -- bun scripts/cleanup-teacher.ts \
  --email teacher@example.com \
  --apply
```

- Cleanup behavior:
  - defaults to dry run and makes no AWS changes until `--apply` is present
  - looks up the Cognito teacher user by email
  - deletes the Cognito user only in apply mode
  - deletes the matching `UserProfileTable` row by Cognito `sub` when the Cognito user exists
  - falls back to `EmailIndex` only when the Cognito user is already gone
  - refuses email fallback while Cognito still has a different `sub`, so it does not unlink the wrong profile
  - refuses ambiguous `EmailIndex` matches so it does not guess across duplicate profiles
  - refuses non-teacher profile records and Cognito users that are already in the `student` group
  - leaves the shared Cognito `teacher` group intact
- Use single-account rollback when only the bootstrapped teacher identity was wrong.
- Use full stage teardown when the entire `ailocal` environment should be discarded and recreated; that is broader than this script and will remove more than the teacher account.
- This is a one-time operational bootstrap. Re-running the bootstrap for the same teacher remains safe for reconciliation after cleanup.
