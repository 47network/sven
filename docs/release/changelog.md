# Sven Changelog

## v0.1.1-rc (2026-03-16)
- Consolidated all recovery/data-preservation work into `thesven` and reduced remote to a single branch.
- Added stash preservation provenance and lossless proof artifacts (`4029/4029` covered, `0` uncovered).
- Hardened parity/release governance lanes and kept Wave 8 parity gates wired into strict release flow.
- Restored calendar OAuth recovery files/migration and fixed shared crypto export regression.
- Refreshed release readiness and status artifact coverage across mobile/gateway/release lanes.

References:
- `docs/release/release-notes-rc-2026-03-16.md`
- `docs/release/status/stash0-lossless-proof-latest.md`

## v0.1.0 (2026-02-13)
- Release candidate baseline locked for mobile, web/admin, desktop (Tauri), and CLI surfaces.
- Added parity and release gates, including final DoD, release ops drill, and post-release verification.
- Added premium UX implementation passes across mobile and web/admin surfaces.
- Added desktop Tauri parity, secure-store controls, and desktop release checksum/provenance workflow.
- Added release operations shell and PowerShell automation for ingress smoke, soak tracking, and gate reporting.

References:
- `docs/release/notes/rc-2026-02-13.md`
