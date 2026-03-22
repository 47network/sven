# Section M: Cutover Gate

**Date**: 2026-02-16  
**Status**: In progress (final signoff evidence being collected)

## 1. Preconditions — all prior sections closed

- Sections **A–L** are documented and the corresponding deliverables are complete (`docs/release/checklists/flutter-user-app-checklist-2026.md`, `section-j-performance-accessibility.md`, `section-k-security-privacy.md`, `section-l-rollout-operations.md`).  
- Telemetry, accessibility, security, rollout, and parity artifacts serve as the record of readiness.

## 2. Quality gate alignment for mobile + web

We require simultaneous quality gates for Flutter mobile and Flutter web before cutting over from RN/Canvas:  
- **Startup/chat latency SLOs** from `docs/architecture/v1-client-scope-slos-2026.md` are instrumented via `PerformanceTracker` events logged in `apps/companion-user-flutter/lib/app/performance_tracker.dart`.  
- **Accessibility guardrails** (contrast, reduced motion, semantics) were captured in `section-j-performance-accessibility.md`.  
- **Security baseline** (token storage, TLS enforcement, secrets scan) is validated in `section-k-security-privacy.md`.  
- **Rollout/operations metrics** (canary evidence, post-release verification) are assembled under `section-l-rollout-operations.md` and `docs/release/status/release-rollout-latest.md`.

Before Section M can be finalized, we need confirmation that the latest mobile/web telemetry traces and SLO reports pass the agreed thresholds, and that the security and rollout artifacts remain green for the release candidate.

## 3. Real-world fallback policy (RN + Canvas)

- The migration plan (`docs/architecture/flutter-user-app-migration-plan-2026.md`) keeps the existing RN + Canvas web builds as fallback paths until the Flutter parity gates are fully satisfied.  
- Cutover requires approving an explicit deprecation date for those fallback builds; until that date, RN/Canvas remain accessible and the rollout can revert traffic to them if Flutter introduces regressions.
- Approval should document the deprecation target (date + conditions) and be added to `docs/release/evidence/` once leadership signs off.

## 4. Production metrics stability

- Post-cutover metrics referenced in `docs/release/status/post-release-verification-latest.*` (health, queue depth, approval flows, chat messages) must stay within the release-level SLO/error budgets defined in the performance capacity artifacts (`docs/performance/performance-capacity-targets-2026.md`, `docs/architecture/observability-standards-2026.md`).  
- Any deviations trigger the rollback path defined in `docs/ops/release-rollback-runbook-2026.md`, and the fallback RN/Canvas versions remain available per the migration plan.

## 5. Next steps to close Section M

1. **Collect final signoff**: Record the release owner’s approval for Flutter mobile + web parity in `docs/release/signoffs/` (new entry `flutter-user-app-signoff-2026-02-16.md` referencing the cutover conditions).  
2. **Document fallback deprecation**: Publish the RN + Canvas deprecation date plus rationale (link from Section M doc and checklist).  
3. **Confirm metrics stability**: Capture the latest `post-release-verification-latest.md` summary showing stable healthz/readyz, approvals throughput, and chat latency after cutting over.  
4. **Announce readiness**: Update release status dashboards and notify operations/support that Flutter is the primary path and that rollbacks should rely on the documented RN/Canvas fallbacks.

Once those artifacts are in place and the release owner signs off, Section M is complete and the Flutter user app can be promoted as the production path.**