# Bridge VM CI Lanes

- Generated at: 2026-03-21T01:45:09.565Z
- Status (vm-local authority): pass
- strict: true
- skip_remote: true

## Checks
- [x] ci_required_local: npm run -s release:ci:required:check:local -> ok
- [x] final_signoff_local: npm run -s release:final:signoff:check:local -> ok
- [x] bridge_lanes_local_strict: npm run -s ops:release:bridge-ci-lanes:check:local:strict -> ok

## Artifacts
- ci_required_local: docs/release/status/ci-required-checks-local-only.json
- final_signoff_local: docs/release/status/final-signoff-local-latest.json
- bridge_lanes_local: docs/release/status/bridge-ci-lanes-latest.json
- bridge_lanes_remote: docs/release/status/bridge-ci-lanes-remote-latest.json
- output_json: docs/release/status/bridge-vm-ci-lanes-latest.json
- output_md: docs/release/status/bridge-vm-ci-lanes-latest.md

## Notes
- remote_check: skipped by --skip-remote
