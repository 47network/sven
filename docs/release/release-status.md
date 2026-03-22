# Release Status Automation

Generate an objective release-readiness snapshot:

```bash
npm run release:status
```

Outputs:
- `docs/release/status/latest.json` (machine-readable)
- `docs/release/status/latest.md` (human summary)

Strict mode (fails if parity rows unresolved or required evidence files are missing):

```bash
node scripts/release-status.js --strict
```

CI workflow:
- `.github/workflows/release-status.yml`
- Uploads the status files as `release-status` artifact.
