# Section L: Rollout & Operations

**Date**: 2026-02-16  
**Status**: In progress (strategy locked, evidence being collected)

## 1. Rollout cadence & validation

The release follows the published `docs/release/canary-rollout-strategy-2026.md`:
- **Phase 0 (internal dogfood)** – Traffic limited to operators/test accounts for 30+ minutes; ensures Flutter-specific harnesses (approvals, notifications, deep-links) flush high-risk issues before opening public beta.
- **Phase 1 (5% canary)** – 60-minute observation window with error budget/latency gating tracked via `docs/release/status/release-rollout-latest.md`. Smoke commands such as `npm run release:admin:dashboard:slo:auth` and `npm run release:verify:post` must pass before scaling.
- **Phase 2 (25% canary)** – Hold for 2 hours with no Sev1/Sev2 incidents; monitor chat, approvals, and admin workflow metrics. Update `docs/release/evidence/` with each phase timestamp.
- **Phase 3 (100% rollout)** – Gradual expansion once canary gates remain stable; final expansion only after post-release verification (health, queue depth, error rate, etc.) clears, referencing `docs/release/post-release-verification-checklist.md`.

## 2. Rollback readiness

- Rollback playbook: `docs/ops/release-rollback-runbook-2026.md` (triggers include sustained SLO breach, auth/chat failures, data integrity warnings).
- The runbook enumerates: gather release ID, stop rollout, revert service images, keep schema changes if safe, run smoke scripts (`npm run release:verify:post`, `npm run release:admin:dashboard:slo:auth`), and validate health post-rollback.
- Release status artifact `docs/release/status/release-rollout-latest.md` confirms the rollback strategy is documented and validated.

## 3. Operational tooling & incident readiness

- **Support runbooks/evidence**: Flutter-specific guidance piggybacks on the broader release docs (canary evidence, token compromise runbook). Ongoing effort to highlight Flutter mobile/web scenarios in `docs/ops/alert-noise-thresholds-2026.md` and `docs/release/evidence/security-baseline-phase*`.
- **Incident playbooks**: The `security-token-compromise-and-key-rotation.md` runbook doubles as the primary high-severity incident guide for tokens/session abuse, covering containment, rotation, communication, and prevention. Alert thresholds in `docs/ops/alert-noise-thresholds-2026.md` ensure operator response triggers before broad impact.
- **Tech support readiness**: The support team will be notified of Flutter parity deliverables during Phase 0, and `docs/release/evidence` includes triaged issues for dogfood/test cohorts.

## 4. Next steps before final release signoff

1. Aggregate canary evidence (phase start/end timestamps, slog metrics) into `docs/release/evidence/canary-phase*-flutter-2026-02-16.md` so the release owner can verify each cohort.  
2. Confirm the rollout metrics (healthz/readyz, approvals, chat) documented in `docs/release/status/post-release-verification-latest.*` following each expansion.  
3. Capture support reference for Flutter-specific operations—brief on chat/approvals telemetry, logging, and token rotation behavior so operators can troubleshoot quickly.  
4. Record a release signoff entry (Section L last checklist bullet) once all evidence is in place and the release owner approves the release window.

Once these steps complete, Section L can be marked complete and we can proceed to Section M (Cutover Gate).