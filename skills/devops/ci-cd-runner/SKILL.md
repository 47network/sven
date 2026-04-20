---
name: ci-cd-runner
version: 1.0.0
category: devops
archetype: operator
description: >
  CI/CD pipeline management skill. Creates, configures, and runs
  continuous integration and deployment pipelines. Supports GitHub
  Actions, Forgejo Actions, Docker builds, and custom scripts.
actions:
  - build: Trigger a build pipeline for a project
  - test: Run test suites with coverage reporting
  - deploy: Deploy to staging or production environment
  - rollback: Revert to a previous deployment version
  - status: Check current pipeline and deployment status
inputs:
  - project: Project name or repository URL
  - environment: Target environment (dev, staging, production)
  - branch: Git branch to build/deploy
  - config: Pipeline configuration overrides
outputs:
  - pipelineId: Unique pipeline run identifier
  - status: Pipeline status (queued, running, passed, failed)
  - duration: Execution time in seconds
  - artifacts: Array of build artifacts with URLs
  - logs: Build/test/deploy log output
pricing:
  model: per_use
  amount: 0.00
  currency: USD
  note: Internal infrastructure skill — no charge
safety:
  - Production deployments require human approval
  - Rollback always available for the last 5 versions
  - Build artifacts scanned for secrets before publishing
  - Resource limits enforced (max 30 min build, 2GB memory)
  - Deployment health checks mandatory before traffic routing
---

# CI/CD Runner

DevOps pipeline management for Sven's infrastructure. Automates build,
test, and deployment workflows across all services.

## Use Cases

- Automated builds on code push to Forgejo
- Test suite execution before deployment
- Rolling deployments to staging and production VMs
- Rollback on failed health checks
- Build Docker images for service updates
