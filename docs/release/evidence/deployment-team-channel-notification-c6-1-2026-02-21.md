# Evidence: Deployment Notification to Team Channel (C6.1)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.1`

## Scope

- Item: `Deployment notification to team channel`

## Implementation

- Workflow updated:
  - `.github/workflows/release-supply-chain.yml`
- Added step:
  - `Notify team channel`
  - Runs on `always()` after release gate checks.
  - Sends webhook notification containing:
    - workflow status (`job.status`)
    - repository
    - branch
    - run URL

## Configuration

- Secret required:
  - `RELEASE_TEAM_WEBHOOK_URL`
- Notification step is no-op when the secret is not configured (`if: ... secrets.RELEASE_TEAM_WEBHOOK_URL != ''`).

## Result

- Release pipeline now supports automated deployment/release gate notifications to a team channel via webhook.
