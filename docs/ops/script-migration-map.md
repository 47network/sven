# Ops Script Migration Map

This maps legacy root-level scripts to canonical consolidated scripts under `scripts/ops/`.

## Mobile Scripts

- `install_nvm_windows.ps1` -> `scripts/ops/mobile/install-nvm.ps1`
- `install_node20_and_start_expo.ps1` -> `scripts/ops/mobile/start-expo.ps1 -NodeMode portable`
- `use_nvm_node20_and_start_expo.ps1` -> `scripts/ops/mobile/start-expo.ps1 -NodeMode nvm`
- `restart_expo_node20.ps1` -> `scripts/ops/mobile/start-expo.ps1 -NodeMode portable -RestartNode -SkipInstall`
- `start_with_provided_paths.ps1` -> `scripts/ops/mobile/start-expo.ps1 -NodeMode auto`
- `.expo_monitor_and_run.ps1` -> `scripts/ops/mobile/monitor-expo-run.ps1`

## Device/Auth Scripts

- `approve_device_db.ps1` -> `scripts/ops/device/approve-device-code-db.ps1`
- `run_confirm.ps1` -> `scripts/ops/device/confirm-device-code.ps1 -Mode login`
- `run_login_confirm.ps1` -> `scripts/ops/device/confirm-device-code.ps1 -Mode login`
- `run_confirm_insert.ps1` -> `scripts/ops/device/confirm-device-code.ps1 -Mode session`
- `approve_and_confirm.ps1` -> `scripts/ops/device/confirm-device-code.ps1 -Mode session`
- `run_and_confirm.ps1` -> `scripts/ops/device/auto-approve-from-ui.ps1 -ApproveMode login`
- `run_and_approve_now.ps1` -> `scripts/ops/device/auto-approve-from-ui.ps1 -ApproveMode db`
- `query_session.ps1` -> `scripts/ops/device/query-session.ps1`

## Policy

- Root-level scripts are compatibility wrappers only.
- New operational automation should be added under `scripts/ops/`.
- Prefer shell entrypoints under `scripts/ops/sh/ops.sh` for Linux/CI workflows.
