# Sven Production Readiness Checklist (A to Z)

Date: 2026-02-13  
Goal: 100% production-ready UX + security + operations across mobile, web, desktop (Tauri), and CLI.

References:

- `docs/architecture/ui-platform-decisions-2026.md`
- `docs/security/ui-app-security-baseline.md`
- `docs/architecture/desktop-tauri-migration-plan.md`

## How To Use This Checklist

- Mark each item complete only when evidence exists in code/docs/CI artifacts.
- Each section has an explicit Definition of Done (DoD).
- No section is considered complete if security controls are missing.
- No scaffold/demo/prototype-only deliverables are accepted as complete.
- Every client surface must be production-capable end-to-end before sign-off.

---

## A. Architecture and Product Scope

- [x] Freeze v1 feature scope per client: mobile, web, desktop, CLI.
- [x] Define shared UX primitives and interaction contracts across clients.
- [x] Define API contract boundaries (chat, auth, approvals, stats, admin).
- [x] Define supported OS/browser matrix for release.
- [x] Define performance SLOs per surface (launch latency, stream latency, crash-free rate).

Evidence:

- `docs/architecture/v1-client-scope-slos-2026.md`
- `docs/architecture/api-contract-boundaries-2026.md`
- `docs/architecture/premium-ux-patterns-2026.md`

DoD:

- [x] Scope doc approved and linked from release notes.
- [x] API contracts versioned and test-covered.

Additional evidence:

- `docs/release/notes/rc-2026-02-13.md`
- `docs/release/evidence/api-contract-versioning-phase1-2026-02-13.md`
- `docs/release/status/api-contract-version-latest.json`

## B. Branding and Design System

- [x] Build a shared design token system (color, spacing, type, radius, motion, elevation).
- [x] Define premium 2026 interaction patterns (streaming, optimistic UI, latency masking, skeletons).
- [x] Create component inventory with states (loading/empty/error/offline/denied).
- [x] Define accessibility visual standards (contrast, typography scale, focus states).

Evidence:

- `packages/shared/design/tokens.json`
- `apps/admin-ui/src/app/tokens.css`
- `apps/canvas-ui/src/app/tokens.css`
- `apps/companion-mobile/src/theme/tokens.ts`
- `docs/architecture/premium-ux-patterns-2026.md`

DoD:

- [x] Design tokens consumed by mobile/web/desktop.
- [x] Components documented with edge states.

Additional evidence:

- `docs/release/evidence/design-tokens-cross-surface-phase1-2026-02-13.md`
- `docs/release/status/design-token-consumption-latest.json`

## C. Core Auth and Session Security

- [x] Standardize device auth/session bootstrap flow across all clients.
- [x] Enforce short-lived tokens + refresh + revocation path.
- [x] Enforce secure storage:
- [x] iOS Keychain / Android Keystore.
- [x] Tauri OS credential store.
- [x] CLI keychain/encrypted fallback.
- [x] Add forced logout and remote session invalidation UX.

Progress evidence:

- `docs/security/mobile-auth-session-hardening-2026-02-13.md`
- `services/gateway-api/src/routes/auth.ts`
- `services/gateway-api/src/__tests__/auth.logout.e2e.ts`
- `services/gateway-api/src/__tests__/mobile-auth-session.e2e.ts`
- `.github/workflows/mobile-auth-session-smoke.yml`
- `scripts/mobile-securestore-release-check.cjs`
- `scripts/security-plaintext-secrets-check.cjs`
- `docs/release/status/mobile-securestore-release-check.json`
- `docs/release/evidence/mobile-securestore-release-validation-2026-02-13.md`
- `docs/release/evidence/mobile-device-android-validation-2026-02-13.md`
- `docs/release/evidence/auth-bootstrap-secure-storage-phase1-2026-02-13.md`
- `docs/release/status/desktop-tauri-securestore-check-latest.json`
- `docs/release/evidence/desktop-tauri-phase5-parity-securestore-2026-02-13.md`

DoD:

- [x] No plaintext secrets/tokens in local files or logs.
- [x] Auth flows pass security smoke tests in CI.

## D. Data and API Reliability

- [x] Implement typed SDK client(s) from server contracts.
- [x] Add strict retry/backoff and idempotency behavior for critical actions.
- [x] Standardize error mapping and user-facing error taxonomy.
- [x] Add circuit-breaker behavior for degraded backends.

Progress evidence:

- `docs/release/evidence/api-reliability-sdk-phase1-2026-02-13.md`
- `docs/release/evidence/api-reliability-dod-phase2-2026-02-13.md`
- `packages/shared/src/sdk/http-client.ts`
- `apps/admin-ui/src/lib/api.ts`
- `apps/canvas-ui/src/lib/api.ts`
- `services/gateway-api/src/__tests__/high-frequency-api.e2e.ts`
- `docs/release/status/api-reliability-observability-latest.json`

DoD:

- [x] All high-frequency API paths have integration tests.
- [x] Observability covers success/error/latency percentiles.

## E. Mobile App (React Native + Expo) Premium Build

- [x] Lock Expo/RN/Node version matrix and enforce with startup preflight checks.
- [x] Enable and verify RN New Architecture.
- [x] Implement production navigation model and deep-link handling.
- [x] Implement high-performance chat timeline (virtualization + streaming updates).
- [x] Implement rich composer (attachments, voice, quick actions).
- [x] Implement approvals workflow with real-time sync and conflict handling.
- [x] Implement notification handling (foreground/background/cold start).
- [x] Implement offline queue and deterministic re-sync.
- [x] Implement crash-safe session restore and device handoff UX.
- [x] Implement premium polish (haptics, motion, transitions, skeleton states).

Progress evidence:

- `docs/release/evidence/mobile-ux-phase1-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase2-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase3-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase4-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase5-newarch-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase6-session-handoff-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase7-matrix-preflight-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase8-polish-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase9-premium-visual-pass-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase10-streaming-feedback-and-interactions-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase11-gesture-and-composer-upgrades-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase12-adb-connectivity-and-device-baseline-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase13-runtime-adaptive-layout-calibration-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase14-grouped-timeline-and-inline-actions-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase15-assistant-cards-and-reveal-animation-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase16-composer-command-picker-and-attachment-tray-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase17-talk-ptt-and-approval-risk-ux-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase18-first-run-onboarding-and-session-setup-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase19-accessibility-contrast-and-microcopy-polish-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase20-rc-adb-smoke-refresh-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase21-rc-adb-perf-snapshot-refresh-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase22-premium-telemetry-and-chat-surface-2026-02-13.md`
- `docs/release/evidence/mobile-ux-phase23-perf-slo-gate-2026-02-13.md`
- `docs/release/status/mobile-perf-slo-latest.json`

DoD:

- [x] Crash-free sessions target met on staging.
- [x] Cold/warm start and chat stream SLOs met on reference devices.
- [x] Mobile preflight gate passes on Windows (PowerShell) and WSL workflows.

## F. Web UI + Admin (Next.js) Premium Build

- [x] Unify admin and canvas UX language with shared tokens/components.
- [x] Harden role-based navigation and action-level authorization UX.
- [x] Build live operational dashboards (health, performance, queues, incidents).
- [x] Build governance surfaces (model policy, canary rollout, audit).
- [x] Add resilient real-time event streams with reconnect strategy.
- [x] Add offline/degraded UX handling for operator-critical screens.

Progress evidence:

- `docs/release/evidence/web-admin-ux-phase1-2026-02-13.md`
- `docs/release/evidence/web-admin-ux-phase2-rbac-2026-02-13.md`
- `docs/release/evidence/web-admin-ux-phase3-governance-2026-02-13.md`
- `docs/release/evidence/web-admin-ux-phase4-highrisk-confirmation-audittrail-2026-02-13.md`
- `docs/release/evidence/web-admin-ux-phase5-dashboard-slo-gate-2026-02-13.md`
- `docs/release/evidence/web-admin-ux-phase6-dashboard-auth-probe-readiness-2026-02-13.md`
- `docs/release/status/admin-dashboard-slo-latest.json`

DoD:

- [x] All admin high-risk actions have confirmations + audit trail.
- [x] Dashboard data latency and error budget targets met.

## G. Desktop App (Tauri) Migration and Hardening

- [x] Build `apps/companion-desktop-tauri` as a full production desktop app (not scaffold).
- [x] Port core features: auth, approvals polling, chat send, notifications.
- [x] Implement secure local config and credential handling.
- [x] Restrict Tauri capabilities (fs/network/shell) to minimum required.
- [x] Lock webview navigation and external URL handling.
- [x] Add signed packaging for Windows/Linux.
- [x] Define and execute Electron deprecation path after parity.

Progress evidence:

- `docs/release/evidence/desktop-tauri-phase1-2026-02-13.md`
- `docs/release/evidence/desktop-tauri-phase2-release-pipeline-2026-02-13.md`
- `docs/release/evidence/desktop-tauri-phase3-electron-deprecation-controls-2026-02-13.md`
- `docs/release/evidence/desktop-tauri-phase4-signing-provenance-2026-02-13.md`
- `docs/release/evidence/desktop-tauri-phase5-parity-securestore-2026-02-13.md`
- `docs/release/evidence/desktop-tauri-phase6-parity-gate-2026-02-13.md`
- `docs/release/evidence/desktop-tauri-phase7-electron-deprecation-executed-2026-02-13.md`
- `docs/release/evidence/quickstart-installer-runtime-phase1-2026-02-14.md`
- `docs/release/status/desktop-tauri-parity-check-latest.json`
- `docs/release/status/quickstart-installer-runtime-latest.json`
- `apps/companion-desktop-tauri/src-tauri/src/main.rs`
- `apps/companion-desktop-tauri/src-tauri/capabilities/default.json`
- `apps/companion-desktop-tauri/src/App.tsx`
- `.github/workflows/desktop-tauri-release.yml`
- `docs/ops/electron-deprecation-runbook-2026.md`
- `scripts/electron-deprecation-check.cjs`

DoD:

- [x] Tauri desktop feature parity achieved.
- [x] Security baseline passes and signed artifacts produced.
- [x] Production installers run and operate on clean Windows/Linux hosts.

## H. CLI (Gemini-Class UX Target)

- [x] Add interactive mode (streaming responses, session context).
- [x] Add deterministic non-interactive mode for scripting/CI.
- [x] Add profile/env switching and secure auth bootstrap.
- [x] Add tool-call trace visibility and safe confirmation flow.
- [x] Add output formats (`text`, `json`, `ndjson`) for automation.
- [x] Add robust error/exit code contract.

Progress evidence:

- `docs/release/evidence/cli-premium-phase1-2026-02-13.md`
- `packages/cli/bin/sven.js`
- `packages/cli/__tests__/cli.e2e.test.js`

DoD:

- [x] CLI e2e tests cover interactive and script workflows.
- [x] Security checks confirm token redaction and safe defaults.

## I. Security Engineering (All Clients)

- [x] Enforce strict transport policies and cert validation.
- [x] Implement CSP and content sanitization where applicable.
- [x] Add secret scanning in CI and pre-release checks.
- [x] Add dependency vulnerability scanning with fail thresholds.
- [x] Add binary signing and provenance attestation.
- [x] Add incident response playbook for token compromise and key rotation.

Progress evidence:

- `docs/release/evidence/security-baseline-phase1-2026-02-13.md`
- `docs/release/evidence/security-baseline-phase2-transport-csp-and-ir-2026-02-13.md`
- `docs/release/evidence/security-baseline-phase3-vuln-remediation-2026-02-13.md`
- `docs/release/evidence/desktop-tauri-phase4-signing-provenance-2026-02-13.md`
- `.github/workflows/security-baseline.yml`
- `.github/workflows/desktop-tauri-release.yml`
- `scripts/security-plaintext-secrets-check.cjs`
- `scripts/security-transport-csp-check.cjs`
- `scripts/dependency-vuln-check.cjs`
- `docs/release/status/dependency-vuln-latest.json`
- `docs/release/status/security-transport-csp-latest.json`
- `docs/runbooks/security-token-compromise-and-key-rotation.md`
- `docs/release/signoffs/security-signoff-2026-02-13-rc.md`
- `docs/release/status/release-candidate-package-latest.json`
- `docs/release/evidence/release-candidate-package-phase1-2026-02-14.md`

DoD:

- [x] Security sign-off doc published for current release candidate.
- [x] No critical/high unresolved vulnerabilities in release scope.

## J. Privacy and Compliance Controls

- [x] Implement data retention controls per data class.
- [x] Implement export/delete user data workflows.
- [x] Ensure audit logs exclude PII/secrets unless required by policy.
- [x] Document telemetry policy and user controls.

Progress evidence:

- `services/gateway-api/src/services/PrivacyService.ts`
- `services/gateway-api/src/routes/admin/privacy.ts`
- `services/gateway-api/src/db/migrations/055_privacy_retention_compat.sql`
- `scripts/privacy-compliance-check.cjs`
- `scripts/ops/admin/run-privacy-compliance-check.ps1`
- `docs/privacy/telemetry-and-user-controls-2026.md`
- `docs/privacy/compliance-checklist-2026.md`
- `docs/release/status/privacy-compliance-latest.json`
- `docs/release/status/compliance-signoff-latest.json`
- `docs/release/evidence/privacy-compliance-phase1-2026-02-14.md`
- `docs/release/signoffs/compliance-signoff-2026-02-14-rc.md`

DoD:

- [x] Retention and deletion tests pass.
- [x] Compliance checklist approved for release.

## K. Performance and Capacity

- [x] Define and test throughput targets for chat and approvals.
- [x] Run load tests for admin dashboards and stats endpoints.
- [x] Validate caching strategy and memory ceilings per client.
- [x] Profile and fix p95/p99 latency bottlenecks.

Progress evidence:

- `docs/performance/performance-capacity-targets-2026.md`
- `scripts/performance-capacity-check.cjs`
- `scripts/ops/admin/run-performance-capacity-check.ps1`
- `docs/release/status/performance-capacity-latest.json`
- `docs/release/evidence/performance-capacity-phase1-2026-02-14.md`
- `docs/release/status/admin-dashboard-slo-latest.json`
- `docs/release/status/mobile-perf-slo-latest.json`

DoD:

- [x] Performance SLO report attached to release evidence.
- [x] Capacity headroom validated for target user load.

## L. Observability and Operability

- [x] Standardize logs, metrics, and traces across services and clients.
- [x] Add client telemetry for crashes, API failure rates, and UX latency.
- [x] Build runbooks for incident triage and degraded mode operations.
- [x] Validate alerting noise thresholds and on-call usability.

Progress evidence:

- `docs/architecture/observability-standards-2026.md`
- `docs/ops/incident-triage-and-degraded-mode-runbook-2026.md`
- `docs/ops/alert-noise-thresholds-2026.md`
- `docs/privacy/telemetry-and-user-controls-2026.md`
- `scripts/observability-operability-check.cjs`
- `scripts/ops/admin/run-observability-operability-check.ps1`
- `docs/release/status/observability-operability-latest.json`
- `docs/release/evidence/observability-operability-phase1-2026-02-14.md`

DoD:

- [x] All P0/P1 failure modes have alert + runbook coverage.
- [x] Operational drill passes.

## M. Testing Strategy and Automation

- [x] Unit test minimum coverage gates enforced.
- [x] Integration test suites for auth/chat/approvals/admin/stats.
- [~] Mobile UI automation on iOS + Android device farms.
  RN app: blocker (2026-02-14) `MAESTRO_CLOUD_API_KEY` not set — skips cloud execution. Required to close: configure secret, rerun `mobile-device-farm` workflow.
  Flutter app: CI workflow added 2026-02-18 — `.github/workflows/flutter-user-app-device-farm.yml`. Maestro flows at `apps/companion-user-flutter/.maestro/flows/`. Also requires `MAESTRO_CLOUD_API_KEY` in repo secrets.
  Flutter app codebase fully parity-complete as of 2026-02-18 Session 2: haptics, skeleton loaders, offline queue, approvals SSE, single-session logout, zero `flutter analyze` issues, web build passing.
  **To enable both**: repo Settings > Secrets and variables > Actions > New secret: `MAESTRO_CLOUD_API_KEY` (obtain from <https://cloud.mobile.dev>).
- [x] Web E2E + accessibility tests.
- [x] Desktop Tauri E2E tests.
- [x] CLI snapshot + contract tests.

Progress evidence:

- `docs/release/evidence/testing-strategy-phase1-2026-02-14.md`
- `docs/release/evidence/testing-strategy-phase2-ui-e2e-2026-02-14.md`
- `docs/release/evidence/testing-strategy-phase3-mobile-device-farm-2026-02-14.md`
- `packages/cli/__tests__/cli.snapshot.test.js`
- `packages/cli/__tests__/__snapshots__/cli.snapshot.test.js.snap`
- `packages/cli/__tests__/cli.e2e.test.js`
- `services/gateway-api/src/__tests__/high-frequency-api.e2e.ts`
- `services/gateway-api/src/__tests__/final-dod.e2e.ts`
- `tests/e2e/ui/admin-login.spec.ts`
- `tests/e2e/ui/canvas-login.spec.ts`
- `tests/e2e/ui/desktop-tauri.spec.ts`
- `playwright.config.ts`
- `scripts/coverage-gate-check.cjs`
- `scripts/mobile-device-farm-config-check.cjs`
- `apps/companion-mobile/.maestro/flows/android-smoke.yaml`
- `apps/companion-mobile/.maestro/flows/ios-smoke.yaml`
- `.github/workflows/parity-e2e.yml`
- `.github/workflows/final-dod-e2e.yml`
- `.github/workflows/mobile-auth-session-smoke.yml`
- `.github/workflows/mobile-device-farm.yml`
- `.github/workflows/ui-e2e-accessibility.yml`
- `.github/workflows/gateway-coverage-gate.yml`
- `docs/release/status/ui-e2e-latest.json`
- `docs/release/status/mobile-device-farm-config-latest.json`
- `docs/release/status/mobile-device-farm-latest.json`

DoD:

- [x] CI required checks all green and stable across branches.
  Completed (2026-02-14): `docs/release/status/ci-required-checks-latest.json` status=`pass`.

## N. Release Engineering and Supply Chain

- [x] Versioning and changelog automation in place.
- [x] Build reproducibility checks implemented.
- [x] Signed artifacts published with checksums.
- [x] Rollback plans validated per client channel.
- [x] Canary rollout strategy documented and tested.

Progress evidence:

- `scripts/release-version-changelog-check.cjs`
- `scripts/release-reproducibility-check.cjs`
- `scripts/release-artifact-manifest-check.cjs`
- `scripts/release-rollout-check.cjs`
- `.github/workflows/release-supply-chain.yml`
- `docs/release/changelog.md`
- `docs/ops/release-rollback-runbook-2026.md`
- `docs/release/canary-rollout-strategy-2026.md`
- `docs/release/status/release-versioning-latest.json`
- `docs/release/status/release-reproducibility-latest.json`
- `docs/release/status/release-artifacts-latest.json`
- `docs/release/status/release-rollout-latest.json`
- `docs/release/status/rollback-rehearsal-latest.json`
- `docs/release/status/release-candidate-package-latest.json`
- `docs/release/evidence/release-supply-chain-phase1-2026-02-14.md`
- `docs/release/evidence/rollback-rehearsal-2026-02-14.md`
- `docs/release/evidence/release-candidate-package-phase1-2026-02-14.md`

DoD:

- [x] Release candidate package set complete and signed.
- [x] Rollback rehearsal passes.

## O. Environment and Secrets Management

- [x] Remove ad-hoc env handling from client build pipelines.
- [x] Enforce scoped secrets per environment (dev/staging/prod).
- [x] Rotate keys/tokens and verify propagation.

Progress evidence:

- `config/env/dev.required.json`
- `config/env/staging.required.json`
- `config/env/prod.required.json`
- `scripts/env-secrets-management-check.cjs`
- `scripts/client-env-pipeline-check.cjs`
- `scripts/key-rotation-rehearsal-check.cjs`
- `.github/workflows/env-secrets-governance.yml`
- `.github/workflows/client-env-governance.yml`
- `.github/workflows/key-rotation-rehearsal.yml`
- `docs/security/secrets-inventory-2026.md`
- `docs/ops/key-rotation-and-propagation-runbook-2026.md`
- `docs/release/status/env-secrets-management-latest.json`
- `docs/release/status/client-env-pipeline-latest.json`
- `docs/release/status/key-rotation-rehearsal-latest.json`
- `docs/release/evidence/env-secrets-management-phase1-2026-02-14.md`
- `docs/release/evidence/key-rotation-rehearsal-phase1-2026-02-14.md`
- `docs/release/evidence/key-rotation-rehearsal-2026-02-14.md`

DoD:

- [x] Secrets inventory is current and validated.
- [x] No secret leakage in build logs/artifacts.

## P. Edge and Network Delivery

- [x] Validate domain split routes and fallback behavior.
- [x] Validate installer and app endpoint health checks.
- [x] Validate TLS renewal and cert chain monitoring.
- [x] Validate rate limits and abuse controls.

Progress evidence:

- `scripts/edge-network-delivery-check.cjs`
- `scripts/edge-network-continuous-check.cjs`
- `.github/workflows/edge-network-delivery.yml`
- `.github/workflows/edge-network-continuous-smoke.yml`
- `config/nginx/extnginx-rate-limit-policy.conf`
- `config/nginx/extnginx-sven-installers.conf`
- `config/nginx/extnginx-sven-app.conf`
- `docs/deploy/edge-rate-limit-and-abuse-controls-2026.md`
- `docs/release/status/edge-network-delivery-latest.json`
- `docs/release/status/edge-network-continuous-latest.json`
- `docs/release/evidence/edge-network-delivery-phase1-2026-02-14.md`
- `docs/release/evidence/edge-network-delivery-phase2-continuous-smoke-2026-02-14.md`

DoD:

- [x] Public ingress smoke checks pass continuously.

## Q. Migration and Legacy Cleanup

- [x] Track Electron deprecation milestones.
- [x] Remove obsolete scripts/configs after Tauri parity.
- [x] Remove stale docs and align canonical runbooks.

Progress evidence:

- `docs/ops/electron-deprecation-milestones-2026.md`
- `docs/release/evidence/desktop-tauri-phase7-electron-deprecation-executed-2026-02-13.md`
- `docs/ops/runbook-index-2026.md`
- `scripts/legacy-cleanup-check.cjs`
- `.github/workflows/legacy-cleanup.yml`
- `docs/release/status/legacy-cleanup-latest.json`
- `docs/release/evidence/legacy-cleanup-phase1-2026-02-14.md`

DoD:

- [x] Legacy path retired without regressions.

## R. Documentation and Onboarding

- [x] Update quickstart for each client.
- [x] Update ops runbooks and troubleshooting trees.
- [x] Add architecture diagrams and trust boundaries.

Progress evidence:

- `docs/architecture/system-diagrams-and-trust-boundaries-2026.md`
- `docs/release/evidence/architecture-diagrams-trust-boundaries-phase1-2026-02-13.md`
- `docs/onboarding/client-quickstart-2026.md`
- `docs/ops/troubleshooting-tree-2026.md`
- `scripts/onboarding-readiness-check.cjs`
- `scripts/onboarding-day1-drill-check.cjs`
- `.github/workflows/onboarding-readiness.yml`
- `docs/release/status/onboarding-readiness-latest.json`
- `docs/release/status/onboarding-day1-drill-latest.json`
- `docs/release/evidence/onboarding-readiness-phase1-2026-02-14.md`
- `docs/release/evidence/onboarding-day1-drill-2026-02-14.md`

DoD:

- [x] New engineer can bootstrap and run all clients in one day.

## S. Final Release Gates (Must Pass)

- [x] `final_dod_ci=true`
- [x] `parity_e2e_ci=true`
- [x] `release_ops_drill_ci=true`
- [x] `post_release_verified=true`
- [x] `week4_rc_complete=true`
- [ ] `soak_72h=true`
  Blocked (2026-02-21): stale soak run was finalized as failed in
  `docs/release/status/soak-72h-summary.json` (`status=fail`, `samples=130/4320`,
  reason=`Soak run interrupted before completion`).

DoD:

- [ ] `docs/release/status/latest.json` shows zero blocking unchecked items.
  Blocker (2026-02-21): `soak_72h=true` is still false and `docs/release/status/latest.json`
  reports `comparison.unresolved_feature_rows=55`.

---

## Per-Client Production Exit Checklist

### Mobile

- [x] App store privacy declarations complete.
- [x] Release build signed and verified.
- [x] Crash-free + ANR-free targets met.

### Web/Admin

- [x] CSP/headers/rate-limit validation complete.
- [x] Admin RBAC penetration test complete.

### Desktop (Tauri)

- [x] Signed binaries for Windows/Linux verified.
- [x] Capability restrictions reviewed and approved.
- [x] Fresh-machine install + login + chat + approvals flows verified (no dev dependencies required).

### CLI

- [x] Secure auth storage validated on target OSes.
- [x] Script-mode contract tests and backward compatibility confirmed.

---

## Final Sign-Off

- [x] Engineering sign-off
- [x] Security sign-off
- [x] Operations sign-off
- [x] Product sign-off
- [x] Release owner approval
  Completed via `docs/release/signoffs/*-2026-02-14-rc.md`.
