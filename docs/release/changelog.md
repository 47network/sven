# Sven Changelog

## v0.2.0 (2026-04-15)
- Upgraded Fastify v4→v5, Next.js v14→v15, React v18→v19, Vite v5→v6 across all affected services and apps.
- Resolved 66 Dependabot security alerts (CVE-2025-32442, CVE-2025-29927, CVE-2025-30346, CVE-2025-45313, and more).
- Added 5 new services: quantum-sim, marketing-intel, document-intel, security-toolkit, model-router.
- Added Tauri desktop companion overlay, tray menu, mini-terminal, and agent state sync.
- Added Canvas UI council mode, memory indicator, video player, and video template features.
- Added Admin UI infrastructure dashboard, render queue monitor, LLM council admin, and ASI-Evolve experiment management.
- Fixed CI lockfile, pre-existing test failures (wake-word, gateway-api, agent-runtime, skill-runner), ESLint configs, and React hooks violations.
- CLI version synced to 0.2.0.

References:
- `CHANGELOG.md` [0.2.0] section for full details

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
