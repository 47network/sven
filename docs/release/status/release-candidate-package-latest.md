# Release Candidate Package Check

Generated: 2026-03-21T02:10:21.328Z
Status: fail

## Checks
- [x] release_versioning_pass: pass
- [x] release_reproducibility_pass: pass
- [x] release_artifacts_pass: pass
- [x] release_rollout_pass: pass
- [x] rollback_rehearsal_pass: pass
- [x] security_dependency_pass: pass
- [x] security_transport_pass: pass
- [ ] release_artifacts_signed_manifest_present: release-artifacts signed_release_artifacts manifest missing/invalid
- [ ] release_artifacts_security_reports_manifest_present: release-artifacts security_report_artifacts manifest missing/invalid
- [ ] release_artifacts_signed_artifacts_present_check_pass: release-artifacts signed_release_artifacts_present check missing/fail
- [ ] release_artifacts_security_reports_present_check_pass: release-artifacts security_report_artifacts_present check missing/fail
- [ ] release_artifacts_release_id_present_check_pass: release-artifacts release_id_present check missing/fail
- [ ] provenance_target_head_sha_present: missing target head SHA (set SVEN_RC_TARGET_HEAD_SHA or CI-provided GITHUB_SHA/CI_COMMIT_SHA)
- [ ] provenance_target_release_id_present: missing target release_id (set SVEN_RC_RELEASE_ID/SVEN_RELEASE_ID or CI ref name)
- [ ] status_fresh:versioning: 821.08h > 72h (docs/release/status/release-versioning-latest.json)
- [ ] provenance_head_sha_present:versioning: missing/invalid head SHA (docs/release/status/release-versioning-latest.json)
- [ ] provenance_head_sha_matches_target:versioning: target head SHA not configured
- [ ] provenance_release_id_present:versioning: missing release_id (docs/release/status/release-versioning-latest.json)
- [ ] provenance_release_id_matches_target:versioning: target release_id not configured
- [ ] status_fresh:reproducibility: 821.08h > 72h (docs/release/status/release-reproducibility-latest.json)
- [ ] provenance_head_sha_present:reproducibility: missing/invalid head SHA (docs/release/status/release-reproducibility-latest.json)
- [ ] provenance_head_sha_matches_target:reproducibility: target head SHA not configured
- [ ] provenance_release_id_present:reproducibility: missing release_id (docs/release/status/release-reproducibility-latest.json)
- [ ] provenance_release_id_matches_target:reproducibility: target release_id not configured
- [ ] status_fresh:artifacts: 821.08h > 72h (docs/release/status/release-artifacts-latest.json)
- [ ] provenance_head_sha_present:artifacts: missing/invalid head SHA (docs/release/status/release-artifacts-latest.json)
- [ ] provenance_head_sha_matches_target:artifacts: target head SHA not configured
- [ ] provenance_release_id_present:artifacts: missing release_id (docs/release/status/release-artifacts-latest.json)
- [ ] provenance_release_id_matches_target:artifacts: target release_id not configured
- [ ] status_fresh:rollout: 821.08h > 72h (docs/release/status/release-rollout-latest.json)
- [ ] provenance_head_sha_present:rollout: missing/invalid head SHA (docs/release/status/release-rollout-latest.json)
- [ ] provenance_head_sha_matches_target:rollout: target head SHA not configured
- [ ] provenance_release_id_present:rollout: missing release_id (docs/release/status/release-rollout-latest.json)
- [ ] provenance_release_id_matches_target:rollout: target release_id not configured
- [ ] status_fresh:rollbackRehearsal: 822.33h > 72h (docs/release/status/rollback-rehearsal-latest.json)
- [ ] provenance_head_sha_present:rollbackRehearsal: missing/invalid head SHA (docs/release/status/rollback-rehearsal-latest.json)
- [ ] provenance_head_sha_matches_target:rollbackRehearsal: target head SHA not configured
- [ ] provenance_release_id_present:rollbackRehearsal: missing release_id (docs/release/status/rollback-rehearsal-latest.json)
- [ ] provenance_release_id_matches_target:rollbackRehearsal: target release_id not configured
- [ ] status_fresh:dependency: 635.47h > 72h (docs/release/status/dependency-vuln-latest.json)
- [ ] provenance_head_sha_present:dependency: missing/invalid head SHA (docs/release/status/dependency-vuln-latest.json)
- [ ] provenance_head_sha_matches_target:dependency: target head SHA not configured
- [ ] provenance_release_id_present:dependency: missing release_id (docs/release/status/dependency-vuln-latest.json)
- [ ] provenance_release_id_matches_target:dependency: target release_id not configured
- [ ] status_fresh:transport: 792.31h > 72h (docs/release/status/security-transport-csp-latest.json)
- [ ] provenance_head_sha_present:transport: missing/invalid head SHA (docs/release/status/security-transport-csp-latest.json)
- [ ] provenance_head_sha_matches_target:transport: target head SHA not configured
- [ ] provenance_release_id_present:transport: missing release_id (docs/release/status/security-transport-csp-latest.json)
- [ ] provenance_release_id_matches_target:transport: target release_id not configured
