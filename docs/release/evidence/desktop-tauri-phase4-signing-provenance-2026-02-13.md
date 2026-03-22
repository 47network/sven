# Desktop Tauri Phase 4 Evidence: Signing and Provenance

Date: 2026-02-13  
Scope: Section G/I release hardening for signed packaging and artifact provenance.

## Implemented

- Release workflow includes signing key env wiring for Tauri bundles:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - File: `.github/workflows/desktop-tauri-release.yml`

- Added provenance attestation stage:
  - job `provenance` after checksum generation
  - `actions/attest-build-provenance@v2` on `desktop-tauri-sha256.txt`
  - workflow permissions include `id-token: write`, `attestations: write`
  - File: `.github/workflows/desktop-tauri-release.yml`

## Verification Path

1. Trigger `desktop-tauri-release` workflow.
2. Confirm `build-windows` and `build-linux` complete.
3. Confirm checksum artifact uploaded (`desktop-tauri-checksums`).
4. Confirm `provenance` job succeeds and attestation is present in workflow summary.
