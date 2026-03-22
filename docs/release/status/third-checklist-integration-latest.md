# Third Checklist Integration Check

Generated: 2026-03-21T02:11:45.582Z
Status: fail

## Checks
- [x] third_checklist_pr_dor_script_present: scripts/pr-dor-metadata-check.cjs
- [x] third_checklist_traceability_script_present: scripts/traceability-matrix-check.cjs
- [ ] third_checklist_pr_template_dor_fields_present: .github/pull_request_template.md
- [ ] third_checklist_pr_template_dod_evidence_fields_present: .github/pull_request_template.md
- [ ] third_checklist_pr_dor_workflow_wired: .github/workflows/pr-dor-metadata.yml
- [x] third_checklist_traceability_evidence_present: docs/release/evidence/traceability-matrix-latest.json
- [x] third_checklist_traceability_release_gates_wired: .github/workflows/release-supply-chain.yml + .github/workflows/release-status.yml
- [ ] third_checklist_authority_config_present: docs/release/checklists/checklist-authority.json
- [ ] third_checklist_scope_labels_declared: required labels missing (in_scope_now, planned_later, out_of_scope)
- [ ] third_checklist_scope_map_present: missing scope_map_path
- [ ] third_checklist_scope_bounded_claims_present: missing checklist-authority scope note in master and/or app checklist
- [ ] third_checklist_reference_mode_explicit: missing authority
