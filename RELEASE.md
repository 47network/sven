# Release Policy

This repository uses an evidence-driven release process.

## Release Gates
- `release:parity:checklist:verify` must pass in strict mode.
- `release:competitive:program:status:strict` must pass.
- Soak evidence must be active and valid for the current release window.
- Required CI provenance gates must pass for the target SHA.

## Artifact Expectations
- Latest status artifacts are written under `docs/release/status/`.
- Evidence artifacts are written under `docs/release/evidence/`.
- Parity and competitor program artifacts are maintained under `docs/parity/`.

## Rollback
- Rollback is executed only via scripted release operations.
- Use repository scripts under `scripts/ops/release/` for promote/finalize/rollback actions.

