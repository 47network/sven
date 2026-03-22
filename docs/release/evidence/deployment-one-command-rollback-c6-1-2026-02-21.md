# Evidence: One-Command Deployment Rollback (C6.1)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.1`

## Scope

- Item: `Deployment rollback: one-command rollback to previous version`

## Implementation

- Added rollback execution command:
  - `scripts/release-rollback-previous.cjs`
  - Executes operator-provided previous-release deploy command and then runs post-rollback verification commands:
    - `npm run release:verify:post`
    - `npm run release:admin:dashboard:slo:auth`
  - Writes rollback status artifacts:
    - `docs/release/status/rollback-last-run.json`
    - `docs/release/status/rollback-last-run.md`
- Added shell wrapper:
  - `scripts/ops/sh/release-rollback-previous.sh`
- Added npm entrypoint:
  - `package.json` -> `release:rollback:previous`
- Runbook integration:
  - `docs/ops/release-rollback-runbook-2026.md`
  - Documents one-command usage pattern:
    - `SVEN_ROLLBACK_PREVIOUS_CMD="<deploy command that restores prior stable release>" npm run release:rollback:previous`

## Result

- Rollback execution is now standardized behind a single command path with mandatory post-rollback verification steps.
