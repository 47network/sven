# Desktop Tauri Phase 2: Release Pipeline (2026-02-13)

## Scope

Added CI release workflow for Windows/Linux desktop bundles with checksum output and signing hooks.

## Delivered

- Workflow:
  - `.github/workflows/desktop-tauri-release.yml`
- Pipeline stages:
  - Windows build (`tauri:build`)
  - Linux build (`tauri:build`)
  - Artifact upload for both platforms
  - SHA256 checksum generation and upload
- Signing hooks:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Validation

Local validation of app build prerequisites:

- `npm --prefix apps/companion-desktop-tauri run typecheck`
- `cargo check --manifest-path apps/companion-desktop-tauri/src-tauri/Cargo.toml`

## Remaining

- Wire production signing secrets in GitHub Actions environment.
- Run release workflow successfully on both targets and attach signed artifacts to release evidence.
