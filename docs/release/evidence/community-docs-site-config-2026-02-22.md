# Community Documentation Site Config (2026-02-22)

- Checklist rows:
  - `A24.1 - Documentation site (Mintlify or Docusaurus)`
  - `B2.1 - Documentation site (Mintlify or Docusaurus) at docs.sven.ai or equivalent`

## Implemented

Added Mintlify-compatible docs site configuration at repository root:

- `docs.json`

The config organizes existing repository documentation into site navigation groups:

- Start
- Operations
- Security
- Community

No content migration was required; existing docs remain source-of-truth and are now structured for static docs-site rendering.

## Notes

- Domain/public hosting (`docs.sven.ai` or equivalent) is deployment/infra and can be wired separately.
