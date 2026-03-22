# Stash 0 Triage Report

Generated: 2026-03-16
Source stash: `stash@{0}`
Recovery branch: `recovery/stash0-useful-2026-03-16`

## Inventory
- Total stash file entries: 1,095
- High-confidence recovery candidates: 501
- Manual docs review set: 59
- Discard/noise set: 535

## Category Summary
- `recover_code_high_confidence`: 473
- `review_root_misc`: 28
- `review_docs_manual`: 59
- `discard_examples_archive`: 383
- `discard_status_generated`: 141
- `discard_generated_assets`: 11

## Restored Into Recovery Branch
- Restored `499` modified files from stash (high-confidence set, `M` status only).
- Did not auto-apply two deletion entries for old Flutter package namespace paths.

Top restored areas:
- `services/` (279)
- `scripts/` (87)
- `apps/` (80)
- `.github/` (20)
- `packages/` (15)

## Files Produced For Review
- `docs/release/status/stash0-name-status.txt`
- `docs/release/status/stash0-numstat.txt`
- `docs/release/status/stash0-topdir-summary.txt`
- `docs/release/status/stash0-triage-summary.json`
- `docs/release/status/stash0-triage-summary.txt`
- `docs/release/status/stash0-recover-m-paths.txt`
- `docs/release/status/stash0-review-docs-paths.txt`
- `docs/release/status/stash0-discard-paths.txt`

## Recommendation
- Treat this recovery branch as an integration lane.
- Validate app + gateway tests before merging anything into `thesven`.
- Cherry-pick by subsystem if needed (`services/`, `apps/companion-user-flutter/`, `.github/workflows/`).
