# Release Status Folder Policy

Purpose: keep `docs/release/status/` clean, deterministic, and CI-friendly.

## Keep
- `*-latest.json` and `*-latest.md`
- `ci-gates.json`
- `production-gap-closure-checklist.md`
- explicitly required soak and benchmark canonical files

## Remove or Avoid Committing
- timestamped duplicates when `-latest` exists
- local watcher logs or transient debug outputs

## Validation
Run:
- `npm run -s release:status:hygiene:report`
