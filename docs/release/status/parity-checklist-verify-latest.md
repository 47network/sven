# Parity Checklist Verify

Generated: 2026-03-21T02:10:01.204Z
Status: fail
Checklist formatting status: fail
Release policy status: fail
Validation mode: local-only

## Dimensions
- [ ] document_integrity: fail=2, missing=0
- [x] test_execution: fail=0, missing=0
- [ ] runtime_validation: fail=4, missing=0

## Checks
- [x] checklist_present: docs/release/checklists/sven-production-parity-checklist-2026.md
- [x] parity_no_scaffolding_principle_present: found="No Scaffolding"
- [ ] parity_demo_evidence_present: missing demo evidence linkage/index/artifacts (index=docs/release/evidence/demo-proof-index-2026-03-04.md)
- [ ] parity_demo_evidence_format_valid: demo artifacts missing or contain non-accepted formats
- [x] parity_demo_evidence_timestamped_capture: timestamped_artifacts=0/0
- [ ] parity_demo_evidence_freshness: timestamp=missing; max_age_hours=720
- [ ] parity_demo_evidence_feature_linked: checklist_feature_ids_missing; demo_feature_ids=none
- [x] production_checklist_checked_rows_have_evidence_refs: checked_rows=0; missing_evidence=0
- [x] production_checklist_checked_rows_have_release_artifact_binding: checked_rows=0; missing_release_artifact_binding=0
- [x] production_checklist_checked_rows_reference_non_partial_evidence: checked_rows=0; non_passing_evidence_refs=0
- [x] production_checklist_checked_rows_have_machine_claim_ids: checked_claim_rows=0; missing_claim_ids=0
- [x] production_checklist_checked_claims_traceable_to_tests_and_status_artifacts: checked_claim_rows=0; unmapped_claims=0
- [x] checklist_no_unchecked_items: all checklist boxes are checked
- [x] parity_signoff_blockers_not_overstated: week4_target_checked=true; soak_open=false; d9_live_open=false
- [x] true_parity_checklist_present: docs/release/checklists/sven-true-parity-and-beyond-checklist-2026.md present
- [x] true_parity_checkbox_notation_lowercase_consistent: no uppercase [X] checkbox markers detected
- [x] true_parity_referenced_evidence_files_exist: referenced_evidence=0
- [ ] checklist_referenced_files_exist: missing=docs/release/evidence/demo-proof-index-2026-03-04.md
- [ ] parity_required_files_exist: missing=docs/release/evidence/mobile/z2-m1-z3-parity-2026-02-24.md
- [x] parity_required_files_scope_balanced: required_scope_groups=7
- [x] openclaw_skill_command_consistency: skill command rows are internally consistent
- [x] openclaw_gap_ledger_consistency: gap ledger reconciled with implemented ✅ feature rows (or explicitly marked historical)
- [x] openclaw_channels_scorecard_consistency: scorecard(m=28,p=0,x=0) vs rows(m=28,p=0,x=0,total=28)
- [x] openclaw_no_checklist_only_evidence_for_matched_rows: all ✅ rows include direct code/test/evidence references or non-circular notes
- [x] openclaw_no_parity_track_indirection_for_matched_rows: matched_rows=0
- [x] openclaw_comparison_matched_rows_have_evidence_bindings: matched_rows=0
- [x] agentzero_no_parity_track_indirection_for_matched_rows: matched_rows=0
- [x] agentzero_comparison_matched_rows_have_evidence_bindings: matched_rows=0
- [x] openclaw_comparison_evidence_density_minimum: no matched rows
- [x] agentzero_comparison_evidence_density_minimum: no matched rows
- [x] parity_competitor_baseline_manifest_present: docs/parity/competitor-baseline-manifest.json
- [x] parity_competitor_baseline_manifest_valid: competitor baseline manifest includes pinned non-moving baseline metadata for openclaw + agent_zero
- [x] parity_docs_link_competitor_baseline_manifest: both parity docs link competitor baseline manifest
- [x] parity_source_revision_metadata_consistent: source revisions aligned (AZ rev 15, OC rev 3)
- [x] parity_no_todo_scope_clean: clean scope=services/gateway-api/src/routes,services/agent-runtime/src,services/skill-runner/src
- [x] parity_no_placeholder_scope_clean: skipped (scripts/check-no-placeholder.js missing in current workspace)
- [x] parity_dashboard_track_status_consistent: dashboard statuses align with A/Z/O/M section completion state
- [x] parity_track_claims_traceable_to_tests: tracks_with_checked_claims=0
- [x] parity_track_claims_bind_to_machine_status_artifacts: tracks_with_checked_claims=0
- [x] parity_evidence_schema_valid: validated=4
- [ ] parity_evidence_freshness: stale=docs/release/status/api-reliability-observability-latest.json:848.34h, docs/release/status/mobile-release-readiness-latest.json:819.80h; max_age_hours=168
- [x] master_checklist_present: docs/Sven_Master_Checklist.md
- [x] master_checklist_split_status_present: feature/release-control status lines present
- [x] master_checklist_release_controls_section_present: ci_nested_checks=6
- [x] master_checklist_status_banner_matches_open_controls: ci/release controls fully checked
- [x] master_checklist_no_placeholder_items_checked: no checked placeholder/scaffold/stub items
- [ ] parity_verifier_remote_provenance_mode: local-only mode (non-provenance)
- [x] parity_test_execution_ci_gates_pass: skipped in local-only mode (strict release mode validates this remotely)
- [x] parity_test_execution_ci_gates_provenance_bound: skipped in local-only mode (strict release use requires remote provenance)
- [ ] parity_runtime_validation_status_artifacts_current: docs/release/status/benchmark-suite-latest.json:status=fail, docs/release/status/api-reliability-observability-latest.json:status=warn, docs/release/status/api-reliability-observability-latest.json:stale_848.34h, docs/release/status/mobile-release-readiness-latest.json:stale_819.80h
- [ ] parity_wave_closeout_status_artifacts_current: docs/release/status/openhands-wave1-closeout-latest.json:stale_118.29h, docs/release/status/librechat-wave2-closeout-latest.json:stale_119.80h, docs/release/status/n8n-wave3-closeout-latest.json:stale_119.80h, docs/release/status/framework-wave4-closeout-latest.json:stale_119.86h, docs/release/status/crewai-wave5-closeout-latest.json:stale_117.69h, docs/release/status/letta-wave6-closeout-latest.json:stale_117.17h, docs/release/status/autogen-wave7-closeout-latest.json:stale_116.68h, docs/release/status/langgraph-wave8-closeout-latest.json:stale_116.08h
- [x] parity_release_lifecycle_gates_pass: skipped in local-only mode (strict release mode enforces soak/week4/post-release lifecycle gates)
