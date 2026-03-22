# CI Gate Sync

This repo tracks release-signoff gates in `docs/release/status/ci-gates.json`.

## Source workflows
- `final-dod-e2e`
- `parity-e2e`
- `d9-keycloak-interop-gate`
- `release-ops-drill`
- `mobile-auth-session-smoke`
- `mobile-release-readiness`
- `backup-restore-api-e2e`
- `flutter-user-app-device-farm`
- `desktop-tauri-release`
- `client-env-governance`
- `mobile-coverage-gate`
- `backend-capability-e2e`
- `security-privacy-governance`
- `privacy-admin-e2e`
- `skill-quarantine-scan`
- `security-audit-unified`
- `security-baseline`
- `bridge-runtime-tests`
- `gateway-bridge-contract-tests`

## Derived gate artifacts
- `docs/release/status/parity-checklist-verify-latest.json`
- `docs/release/status/mcp-server-compat-latest.json`
- `docs/release/status/a2a-compat-latest.json`
- `docs/release/status/langgraph-wave8-rollup-latest.json`
- `docs/release/status/langgraph-wave8-closeout-latest.json`
- `docs/release/status/competitor-executable-smoke-latest.json`

## Wave 8 Contract Coverage
- `services/gateway-api/src/__tests__/langgraph-wave8-parity-e2e-ci-binding.contract.test.ts`
- `services/gateway-api/src/__tests__/parity-all-waves-closeout-contract.test.ts`
- `services/gateway-api/src/__tests__/parity-checklist-verify-wave-closeout.contract.test.ts`

## Required quality checks
- `ops-shell-ci` must pass for release readiness when shell ops scripts are changed.
- Workflow: `.github/workflows/ops-shell-ci.yml`
- Scope: shell syntax checks, optional `shellcheck`, `ops.sh` dispatch smoke test, and quickstart installer smoke check (`quickstart-static` + `/install.{sh,ps1,cmd}` content-type/status validation).
- Scope source of truth: `config/release/ops-shell-scope.json` (consumed by gate scripts/workflows).

## Automation
- Workflow: `.github/workflows/release-gates-sync.yml`
- Trigger: on completion of source workflows or manual dispatch
- Actions:
  1. Refresh derived gate artifacts:
     - `npm run release:parity:checklist:verify`
     - `npm run release:mcp:compat:check`
     - `npm run release:a2a:compat:check`
  2. Refresh `docs/release/status/ci-gates.json` from workflow runs + derived gate artifacts
  3. Preserve manual human gates from existing `ci-gates.json`:
     - `soak_72h`
     - `week4_rc_complete`
     - `post_release_verified`
  4. Recompute `docs/release/status/latest.json` and `docs/release/status/latest.md`
  5. Apply checklist updates via `npm run release:checklist:update`

`parity-e2e` hard-gates LangGraph Wave 8 by executing `release:langgraph:w01:status` .. `release:langgraph:w10:status`, `release:langgraph:wave8:rollup`, and `release:langgraph:wave8:closeout`; `parity-e2e-latest.json` includes `langgraph_wave8` and global status fails if it is not `pass`.

## Release Enforcement
- Workflow: `.github/workflows/release-supply-chain.yml`
- Manual dispatch (`workflow_dispatch`) runs strict release-readiness gates after supply-chain checks:
  - `npm run release:ci:required:check -- --strict`
  - `npm run release:final:signoff:check -- --strict`
- Artifacts uploaded:
  - `docs/release/status/ci-required-checks-latest.{json,md}`
  - `docs/release/status/final-signoff-latest.{json,md}`
- Bridge integration lane enforcement before promotion:
  - `ci-required-checks-latest.json` must include passing checks:
    - `latest_run_success:bridge-runtime-tests`
    - `latest_run_success:gateway-bridge-contract-tests`
  - `final-signoff-latest.json` must include passing checks:
    - `ci_required_checks_bridge_runtime_latest_run_success`
    - `ci_required_checks_gateway_bridge_contract_latest_run_success`

## Manual usage

```bash
npm run release:status
npm run release:checklist:update
npm run ops:release:prep-all
npm run ops:release:prep-rollout
npm run ops:release:prep-final-signoff
npm run ops:release:bridge-ci-lanes:check:strict
npm run ops:release:bridge-ci-lanes:check:local:strict
npm run ops:release:bridge-ci-lanes:remote:strict
npm run release:gate:set -- soak_72h true
npm run release:soak:promote
npm run release:ci:required:check:local
npm run release:final:signoff:check:local
```

Strict release-promotion verification for bridge lanes:

```bash
npm run release:ci:required:check -- --strict
jq '.checks[] | select(.id=="latest_run_success:bridge-runtime-tests" or .id=="latest_run_success:gateway-bridge-contract-tests") | {id,pass,detail}' \
  docs/release/status/ci-required-checks-latest.json

npm run release:final:signoff:check -- --strict
jq '.checks[] | select(.id=="ci_required_checks_bridge_runtime_latest_run_success" or .id=="ci_required_checks_gateway_bridge_contract_latest_run_success") | {id,pass,detail}' \
  docs/release/status/final-signoff-latest.json

npm run ops:release:bridge-ci-lanes:check:strict
cat docs/release/status/bridge-ci-lanes-latest.json
```

For offline/dev-only validation (not release authority), first refresh local artifacts then run:

```bash
npm run release:ci:required:check:local
npm run release:final:signoff:check:local
npm run ops:release:bridge-ci-lanes:check:local:strict
```

Fast GitHub-backed bridge-only evidence (without full required-workflows sweep):

```bash
export BRIDGE_CI_LANES_GH_REPO=47network/thesven
npm run ops:release:bridge-ci-lanes:remote:strict
cat docs/release/status/bridge-ci-lanes-remote-latest.json
```

No-budget VM-authoritative fallback:

```bash
npm run ops:release:bridge-vm-ci-lanes:strict:skip-remote
cat docs/release/status/bridge-vm-ci-lanes-latest.json

# post VM evidence summary to PR
npm run ops:release:bridge-vm-ci-lanes:pr-comment -- --repo 47network/thesven --pr <number>

# one-command VM run + PR evidence comment
npm run ops:release:bridge-vm-ci-lanes:run-and-comment -- --repo 47network/thesven --pr <number>
```

Self-hosted runner dispatch for bridge lanes (manual run):

```bash
gh workflow run bridge-runtime-tests.yml -R 47network/thesven --ref <branch> -f runner_target=self-hosted
gh workflow run gateway-bridge-contract-tests.yml -R 47network/thesven --ref <branch> -f runner_target=self-hosted
```

`release:ci:required:check:local` is for local/offline validation only. CI must use the default remote-aware gate.
In local-only mode it now skips live/heavy lanes up front (instead of executing then overriding), so diagnostics complete quickly while keeping CI as the authority.
`release:final:signoff:check:local` is also local/offline-only and does not satisfy CI signoff requirements.
`release:final:signoff:check:local` additionally requires `docs/release/status/latest.json` to report `d9_keycloak_interop.local_selfcheck_status=pass` and `d9_keycloak_interop.local_selfcheck_validation_status=valid`.
`release:final:signoff:check:local` also requires `docs/release/status/d9-local-readiness-latest.json` with `status=pass`.

Combined release prep artifacts:
- `docs/release/status/release-ops-prep-latest.json`
- `docs/release/status/release-ops-prep-latest.md`
- `docs/release/status/release-ops-next-steps.ps1`

Mobile prep artifacts:
- `docs/release/status/mobile-release-prep-latest.json`
- `docs/release/status/mobile-release-prep-latest.md`
- `docs/release/status/mobile-release-next-steps.ps1`

Rollout prep artifacts:
- `docs/release/status/release-rollout-prep-latest.json`
- `docs/release/status/release-rollout-prep-latest.md`
- `docs/release/status/release-rollout-next-steps.ps1`

The combined JSON/markdown prep artifacts also surface the mobile define-file mutation details:
- target file
- backup file
- rollback command

The dedicated mobile prep artifacts also surface:
- the mobile execution model
- mobile source materials
- mobile input mapping
- blocker-aware mobile next steps in execution order
- mobile perf-capture hints
- the preferred mobile-only handoff script

The combined rollout section in those same prep artifacts also surfaces:
- rollout source materials
- canary evidence templates
- rollback runbook references

The combined prep artifacts also include an explicit execution model:
- soak steps can run without mobile or signoff placeholders
- mobile steps require only mobile inputs
- signoff steps require only signoff approver inputs

Preferred signoff flow:
- run `npm run ops:release:prep-all`
- review `docs/release/status/release-ops-next-steps.ps1`
- fill the editable variables required for the section you are about to run in `docs/release/status/release-ops-next-steps.ps1`
- if the mobile define-file step is used, note that it writes `config/env/mobile-dart-defines.release.local.json.bak` first and prints the rollback command
- if needed, drill into `npm run ops:release:prep-final-signoff`
- review the emitted `release_id`, `head_sha`, and `artifact_manifest_hash`
- review the emitted per-role `selected_doc` and `failing_checks`
- execute the emitted `scripts/ops/release/set-final-signoff.ps1` commands with real approver names after evidence review
- rerun `npm run release:final:signoff:check -- --strict`

Preferred rollout flow:
- run `npm run ops:release:prep-all`
- or drill into `npm run ops:release:prep-rollout`
- review `docs/release/status/release-rollout-prep-latest.json` or `docs/release/status/release-rollout-prep-latest.md`
- review `docs/release/status/release-rollout-prep-latest.md`
- `docs/release/status/release-rollout-prep-latest.md` now includes the rollout execution model, artifact paths, rollout defaults, and rollout next steps
- or edit `docs/release/status/release-rollout-next-steps.ps1`
- `docs/release/status/release-rollout-next-steps.ps1` is the preferred rollout-only handoff when you are working just the rollout lane
- its editable variables are rollout-scoped only; mobile and signoff placeholders are not required there
- when soak is already active, rollout is the first evidence lane to work
- run the emitted rollout evidence setter command
- rerun `npm run release:rollout:check`

Required signoff manifest fields per role:
- `date`
- `approver`
- `status`
- `release_id`
- `head_sha`
- `artifact_manifest_hash`
- `expires_at`
- `staging_evidence_url`
- `dashboard_url`

Set these flags in `docs/release/status/ci-gates.json` when human gates complete:
- `soak_72h`
- `week4_rc_complete`
- `post_release_verified`

Manual closure with provenance (sandbox mode):

```bash
SVEN_RELEASE_GATE_MODE=sandbox \
SVEN_RELEASE_GATE_EVIDENCE_RUN_ID=<run-id> \
SVEN_RELEASE_GATE_EVIDENCE_HEAD_SHA=<head-sha-hex> \
SVEN_RELEASE_GATE_EVIDENCE_URL=<workflow-or-evidence-url> \
npm run release:gate:set -- soak_72h true

SVEN_RELEASE_GATE_MODE=sandbox \
SVEN_RELEASE_GATE_EVIDENCE_RUN_ID=<run-id> \
SVEN_RELEASE_GATE_EVIDENCE_HEAD_SHA=<head-sha-hex> \
SVEN_RELEASE_GATE_EVIDENCE_URL=<workflow-or-evidence-url> \
npm run release:gate:set -- week4_rc_complete true

SVEN_RELEASE_GATE_MODE=sandbox \
SVEN_RELEASE_GATE_EVIDENCE_RUN_ID=<run-id> \
SVEN_RELEASE_GATE_EVIDENCE_HEAD_SHA=<head-sha-hex> \
SVEN_RELEASE_GATE_EVIDENCE_URL=<workflow-or-evidence-url> \
npm run release:gate:set -- post_release_verified true
```

Preferred soak flow:
- finalize soak if needed: `npm run release:soak:finalize`
- restart a failed or expired soak cleanly: `npm run release:soak:restart`
- auto-promote validated soak gates: `npm run release:soak:promote`
- when using the combined handoff, prefer running the soak commands directly from `docs/release/status/release-ops-next-steps.ps1`
- the soak section does not require mobile or signoff placeholders to be filled first

Preferred mobile flow:
- run `npm run ops:release:prep-all`
- or drill into `npm run ops:mobile:prep-release-evidence`
- review `docs/release/status/mobile-release-prep-latest.json` or `docs/release/status/mobile-release-prep-latest.md`
- edit `docs/release/status/mobile-release-next-steps.ps1`
- `docs/release/status/mobile-release-next-steps.ps1` is the preferred mobile-only handoff when you are working just the mobile lane
- its editable variables are mobile-scoped only; rollout and signoff placeholders are not required there
- current RC scope is `android-only`; iOS is explicitly `deferred`
- for this RC, mobile handoff and readiness checks must not require `IosBuildRef` or iOS signing artifacts
- in the combined release path, mobile comes after rollout and before final signoff while soak continues
- rerun `npm run mobile:release:readiness:check`

Automated CI gate keys maintained by sync workflow:
- `final_dod_ci`
- `parity_e2e_ci`
- `parity_checklist_verify_ci`
- `mcp_server_compat_ci`
- `a2a_compat_ci`
- `d9_keycloak_interop_ci`
- `release_ops_drill_ci`
- `desktop_release_ci`
- `client_env_governance_ci`
- `backend_capability_e2e_ci`
- `security_privacy_governance_ci`
- `privacy_admin_e2e_ci`
- `skill_quarantine_scan_ci`
- `security_audit_unified_ci`
- `security_baseline_ci`
- `ops_shell_ci_required` (conditional requirement flag)
- `ops_shell_ci` (must be `true` when `ops_shell_ci_required=true`)

Mobile signal scope labels:
- `mobile_auth_session_smoke_ci`: `mobile_api_auth_session_smoke` (gateway auth lifecycle API contract)
- `flutter_user_app_device_farm_ci`: `mobile_app_device_smoke` (Flutter app/device-farm execution)

Notes:
- Local validation was run on February 13, 2026 via `npm run test:final-dod:local` and `npm run test:parity-e2e:local`.
- CI gating requires this repo to have a configured Git remote before workflow dispatch can be used from this workspace.
- Soak operations runbook: `docs/release/soak-72h-runbook.md`.
