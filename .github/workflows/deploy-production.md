name: Deploy Production

on:
push:
branches: - production

run-name: Deploy production from ${{ github.ref_name }} by @${{ github.actor }}

permissions:
contents: read

concurrency:
group: deploy-production
cancel-in-progress: false

jobs:
deploy:
name: Deploy production
runs-on: ubuntu-latest
timeout-minutes: 60
permissions:
contents: read
id-token: write
environment: production
env:
AUTH_E2E_MODE: ""
AWS_REGION: ${{ vars.AWS_REGION }}
      AWS_ROLE_ARN: ${{ secrets.AWS_ROLE_ARN }}
BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
      BETTER_AUTH_URL: ${{ vars.BETTER_AUTH_URL || vars.NEXT_PUBLIC_APP_URL }}
ECCS_EMAIL_SENDER: ${{ vars.ECCS_EMAIL_SENDER }}
      NEXT_PUBLIC_APP_URL: ${{ vars.NEXT_PUBLIC_APP_URL }}
RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}

    steps:
      - name: Validate production configuration
        shell: bash
        run: |
          missing=()
          for name in AWS_ROLE_ARN AWS_REGION BETTER_AUTH_SECRET BETTER_AUTH_URL ECCS_EMAIL_SENDER NEXT_PUBLIC_APP_URL RESEND_API_KEY; do
            if [[ -z "${!name}" ]]; then
              missing+=("$name")
            fi
          done

          if (( ${#missing[@]} > 0 )); then
            echo "::error::Missing required GitHub Environment configuration for 'production': ${missing[*]}"
            exit 1
          fi

          for name in BETTER_AUTH_URL NEXT_PUBLIC_APP_URL; do
            value="${!name}"
            if [[ "$value" != https://* ]]; then
              echo "::error::$name must use an https:// production URL."
              exit 1
            fi
            if [[ "$value" == *localhost* || "$value" == *127.0.0.1* ]]; then
              echo "::error::$name must not point at localhost for production."
              exit 1
            fi
          done

      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.10"

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Restore Bun & Next.js cache
        uses: actions/cache@v5
        with:
          path: |
            ~/.bun/install/cache
            ${{ github.workspace }}/.next/cache
          key: ${{ runner.os }}-bun-nextjs-${{ hashFiles('**/bun.lockb') }}-${{ hashFiles('**/*.{js,jsx,ts,tsx}') }}-v1
          restore-keys: |
            ${{ runner.os }}-bun-nextjs-

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v6.1.0
        with:
          aws-region: ${{ env.AWS_REGION }}
          role-session-name: eccs-ai-production-${{ github.run_id }}
          role-to-assume: ${{ env.AWS_ROLE_ARN }}
          action-timeout-s: 120

      - name: Deploy SST production stage
        run: bunx sst deploy --stage production

      - name: Write deployment artifact
        if: ${{ always() }}
        shell: bash
        run: |
          mkdir -p artifacts
          {
            echo "# Production Deployment"
            echo
            echo "- Workflow: $GITHUB_WORKFLOW"
            echo "- Run: $GITHUB_RUN_ID"
            echo "- Actor: $GITHUB_ACTOR"
            echo "- Event: $GITHUB_EVENT_NAME"
            echo "- Ref: ${GITHUB_REF_NAME:-unknown}"
            echo "- Requested deploy ref: $GITHUB_REF"
            echo "- Stage: production"
            echo "- Reason: push-${GITHUB_REF_NAME:-unknown}"
            echo "- App URL: $NEXT_PUBLIC_APP_URL"
          } > artifacts/production-deploy-summary.md

      - name: Upload deployment artifact
        if: ${{ always() }}
        uses: actions/upload-artifact@v5
        with:
          name: production-deploy-summary
          path: artifacts/production-deploy-summary.md
          if-no-files-found: ignore
          retention-days: 30

      - name: Save Bun & Next.js cache
        uses: actions/cache@v5
        with:
          path: |
            ~/.bun/install/cache
            ${{ github.workspace }}/.next/cache
          key: ${{ runner.os }}-bun-nextjs-${{ hashFiles('**/bun.lockb') }}-${{ hashFiles('**/*.{js,jsx,ts,tsx}') }}-v1
