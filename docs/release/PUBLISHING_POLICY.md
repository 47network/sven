# Publishing Policy

This repository follows a curated publish profile for public release quality.

## Included
- Product/runtime code (`apps/`, `services/`, `packages/`, `config/`, `deploy/`)
- Operational and user docs (`docs/`), excluding mirrored competitor source snapshots
- Canonical release evidence in `docs/release/status/` (`*-latest.{json,md}`, policy files)

## Excluded
- Local archive/development residue (`archive/`)
- Third-party competitor source mirrors (`docs/examples/`)
- Timestamped/generated duplicate status artifacts when canonical `-latest` equivalents exist

## Enforcement
- Hygiene checks must pass before publish:
  - `npm run -s release:bundle:hygiene:report`
  - `npm run -s release:status:hygiene:report`
- Release status should be reproducible from canonical `-latest` artifacts.
