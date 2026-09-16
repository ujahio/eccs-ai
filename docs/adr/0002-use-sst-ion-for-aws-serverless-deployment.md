# ADR 0002: Use SST Ion for AWS Serverless Deployment

- **Status:** Accepted (retrospectively documented)
- **Decision date:** 2026-06-29
- **Recorded date:** 2026-09-15

## Context

ECCS is a full-stack Next.js application with AWS-hosted authentication, persistence, object storage, scheduled jobs, and application runtime resources. The repository requires a serverless architecture to keep operating costs low and requires infrastructure definitions to remain alongside the application in TypeScript.

This record was reconstructed after implementation. The repository confirms the low-cost serverless objective and the exclusive use of SST Ion, but it does not preserve the original comparison that led to SST instead of another infrastructure-as-code system.

## Decision

Use SST Ion as the sole infrastructure-as-code and deployment system for ECCS on AWS.

Keep deployable components under `infra/` and load them dynamically from `sst.config.ts`. Use SST resource links to supply deployed resource identifiers and secrets to application functions and scripts instead of duplicating resource names in standalone environment variables. Use named SST stages to isolate local, staging, production, and temporary environments.

Deploy the application with AWS serverless services, including the SST Next.js component, Lambda functions, DynamoDB tables, S3, Cognito, and scheduled functions. Do not introduce Terraform, AWS CDK, CloudFormation templates, Pulumi, or a parallel infrastructure control plane.

## Alternatives considered

- Terraform, AWS CDK, CloudFormation, and Pulumi are explicitly prohibited by the repository's operating rules. The historical evaluation and rejection rationale for each alternative are unknown.
- A containerized Next.js runtime on Fargate and an Application Load Balancer was explored on an unmerged branch after this decision. It is not evidence of an accepted replacement and is not part of the current architecture.
- The reason SST Ion was selected over other serverless deployment abstractions is unknown beyond the confirmed goals of low-cost serverless operation, colocated TypeScript infrastructure, and linked resources.

## Consequences

### Positive

- Application and infrastructure code use the same TypeScript-oriented toolchain.
- SST stages provide a consistent isolation mechanism across local and deployed environments.
- Resource linking avoids hard-coded deployed resource names and centralizes permissions and bindings.
- Serverless managed services reduce persistent infrastructure and operational overhead.

### Negative

- ECCS depends on SST's component model and deployment lifecycle.
- Next.js deployment behavior also depends on SST's OpenNext integration.
- Migrating to another infrastructure system would require replacing resource definitions, stage behavior, permissions, and runtime resource bindings.
- Developers need AWS and SST access even for local flows that exercise linked cloud resources.

## Evidence

- `AGENTS.md:29-44` specifies SST Ion, AWS backend resources, and a low-cost serverless architecture using API Gateway and Lambda.
- `AGENTS.md:97-112` requires component files under `infra/`, dynamic imports from `sst.config.ts`, exported SST resources, and SST-linked scripts.
- `README.md:3-20` identifies SST Ion and AWS serverless services and prohibits other infrastructure-as-code systems.
- `README.md:38-40` requires normal local development to run Next.js through SST so bindings are available.
- `sst.config.ts:1-18` declares AWS as the application home and dynamically imports all infrastructure components.
- `package.json:8-9,19-22,41` defines stage-aware SST commands and pins the SST dependency.
- Commit `81c8c2f` (2026-06-29), `first phase infra addition + project setup`, introduced the initial SST configuration and Next.js infrastructure component.

