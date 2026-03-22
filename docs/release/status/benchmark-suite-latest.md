# Benchmark Suite Gate

Generated: 2026-03-21T00:35:21.855Z
Status: fail

## Checks
- [x] f1_onboarding_executed: benchmark script executed successfully (exit=2)
- [x] f1_onboarding_artifact_present: docs/release/status/f1-onboarding-benchmark-latest.json
- [x] f1_onboarding_status_pass: status=inconclusive (accepted in relaxed-local mode)
- [x] f1_onboarding_fresh: 0.00h <= 72h
- [ ] f1_onboarding_provenance_present: run_id=local-1774052940068 evidence_mode=benchmark_runtime_probe head_sha=(missing)
- [x] f2_ui_operability_executed: benchmark script executed successfully (exit=2)
- [x] f2_ui_operability_artifact_present: docs/release/status/f2-ui-operability-benchmark-latest.json
- [x] f2_ui_operability_status_pass: status=inconclusive (accepted in relaxed-local mode)
- [x] f2_ui_operability_fresh: 0.00h <= 72h
- [ ] f2_ui_operability_provenance_present: run_id=local-1774052941432 evidence_mode=csv_benchmark_input head_sha=(missing)
- [ ] f3_reliability_recovery_executed: exit=1 f3-local-runner: preflight token=no policy_cookie=no api=http://127.0.0.1:15811
f3-reliability-recovery-benchmark: fail (passed=1 failed=1 skipped=2)
- [x] f3_reliability_recovery_artifact_present: docs/release/status/f3-reliability-recovery-benchmark-latest.json
- [ ] f3_reliability_recovery_status_pass: status=fail
- [x] f3_reliability_recovery_fresh: 0.00h <= 72h
- [ ] f3_reliability_recovery_provenance_present: run_id=local-1774052941502 evidence_mode=local_runner head_sha=(missing)
- [x] f4_security_defaults_executed: benchmark script executed successfully (exit=2)
- [x] f4_security_defaults_artifact_present: docs/release/status/f4-security-defaults-benchmark-latest.json
- [x] f4_security_defaults_status_pass: status=inconclusive (accepted in relaxed-local mode)
- [x] f4_security_defaults_fresh: 0.00h <= 72h
- [ ] f4_security_defaults_provenance_present: run_id=local-1774053302475 evidence_mode=runtime_security_probe head_sha=(missing)
- [ ] competitor_runtime_guard_executed: exit=2 Wrote docs/release/status/competitor-runtime-guard-latest.json
Wrote docs/release/status/competitor-runtime-guard-latest.md
competitor-runtime-guard-check: inconclusive
- [x] competitor_runtime_guard_artifact_present: docs/release/status/competitor-runtime-guard-latest.json
- [ ] competitor_runtime_guard_status_pass: status=inconclusive
- [x] competitor_runtime_guard_fresh: 0.00h <= 72h
- [ ] competitor_runtime_guard_provenance_present: run_id=local-1774053302738 evidence_mode=runtime_container_inventory_probe head_sha=(missing)
- [ ] competitor_capability_proof_executed: exit=2 Wrote docs/release/status/competitor-capability-proof-latest.json
Wrote docs/release/status/competitor-capability-proof-latest.md
- [x] competitor_capability_proof_artifact_present: docs/release/status/competitor-capability-proof-latest.json
- [ ] competitor_capability_proof_status_pass: status=fail
- [x] competitor_capability_proof_fresh: 0.00h <= 72h
- [ ] competitor_capability_proof_provenance_present: run_id=local-1774053302835 evidence_mode=competitor_feature_row_proof head_sha=(missing)
- [ ] competitor_runtime_truth_executed: exit=2 Wrote docs/release/status/competitor-executable-smoke-latest.json
Wrote docs/release/status/competitor-executable-smoke-latest.md
Wrote docs/release/status/competitor-runtime-truth-latest.json
Wrote docs/release/status/competitor-runtime-truth-latest.md
- [x] competitor_runtime_truth_artifact_present: docs/release/status/competitor-runtime-truth-latest.json
- [ ] competitor_runtime_truth_status_pass: status=fail
- [x] competitor_runtime_truth_fresh: 0.00h <= 72h
- [ ] competitor_runtime_truth_provenance_present: run_id=local-1774053302932 evidence_mode=runtime_truth_strict head_sha=(missing)
- [ ] competitive_scorecard_executed: exit=2 Wrote docs/release/status/competitive-scorecard-latest.json
Wrote docs/release/status/competitive-scorecard-latest.md
- [x] competitive_scorecard_artifact_present: docs/release/status/competitive-scorecard-latest.json
- [ ] competitive_scorecard_status_pass: status=fail
- [x] competitive_scorecard_fresh: 0.00h <= 72h
- [ ] competitive_scorecard_provenance_present: run_id=local-1774053321801 evidence_mode=competitive_weighted_scorecard head_sha=(missing)
