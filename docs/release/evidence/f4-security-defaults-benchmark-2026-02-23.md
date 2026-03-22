# F4 Security-By-Default Benchmark (Automation Baseline)

- Date: 2026-02-23
- Scope: security-default benchmark runner for inbound unauthenticated denial matrix + security-audit remediation metadata
- Status: automation baseline complete (not final competitor benchmark evidence)

## Harness

- Script: `scripts/f4-security-defaults-benchmark.cjs`
- NPM command: `npm run benchmark:f4:security-defaults`
- Outputs:
  - `docs/release/status/f4-security-defaults-benchmark-latest.json`
  - `docs/release/status/f4-security-defaults-benchmark-latest.md`

## Denial Matrix Coverage

- Adapter ingress:
  - `POST /v1/events/message` (missing token, bad token)
  - `POST /v1/events/file` (missing token)
  - `POST /v1/events/audio` (missing token)
  - `POST /v1/adapter/identity/resolve` (missing token)
- Admin/tool/user action surfaces:
  - `POST /v1/admin/webhooks` (unauth, forged session)
  - `POST /v1/tools/browser/action` (unauth)
  - `POST /v1/push/register` (unauth)
  - `POST /v1/chat/completions` (missing bearer)

## Security Audit Metadata Check

- Runner also validates:
  - `sven security audit --json` output can be parsed
  - high-risk findings include actionable metadata when determinable:
    - `severity`
    - `config_path`
    - `remediation`

## Baseline Run

- Command: `npm run benchmark:f4:security-defaults`
- API target: `http://127.0.0.1:8080`
- Result: `inconclusive (passed=0 failed=0 skipped=10)`
- Probe note:
  - `GET /healthz` returned `502`, so denial checks are marked skipped (`gateway_unavailable`) to avoid false pass/fail against an unhealthy target.
- Security-audit metadata check: pass
  - high risk findings: `3`
  - high risk with metadata: `2`
  - partial metadata entries: `0`

## Next Run Requirements

- Re-run against healthy gateway API (`/healthz` returns `200` or `503` from gateway service, not edge `502`).
- Set optional `F4_REMEDIATION_MINUTES=<n>` to finalize the operator-remediation-time criterion.
- For final F4 pass evidence, require:
  - denial matrix with `0` unauthenticated inbound actions accepted
  - security-audit metadata check pass
  - operator remediation time `<= 10` minutes

## Healthy Gateway Re-Run

- Date: 2026-02-23
- Command:
  - `API_URL=http://127.0.0.1:3000`
  - `npm run benchmark:f4:security-defaults`
- Result: `inconclusive (passed=10 failed=0 skipped=0)`
- Why still inconclusive:
  - denial matrix is fully green (`10/10`)
  - security-audit metadata check is pass (`high_risk_with_meta=3/3`, `partial_meta=0`)
  - operator-remediation-time input (`F4_REMEDIATION_MINUTES`) not set yet
- Output artifacts:
  - `docs/release/status/f4-security-defaults-benchmark-latest.json`
  - `docs/release/status/f4-security-defaults-benchmark-latest.md`
