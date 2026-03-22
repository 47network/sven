# F4 Security-By-Default Benchmark (Final Pass)

- Date: 2026-02-23
- Environment: local Docker stack, healthy gateway API
- API target: `http://127.0.0.1:3000` (`/healthz` = `200`)

## Command

- `API_URL=http://127.0.0.1:3000`
- `F4_REMEDIATION_MINUTES=8`
- `npm run benchmark:f4:security-defaults`

## Result

- Benchmark status: `pass`
- Summary:
  - denial checks: `10/10` passed
  - unauthenticated inbound actions accepted: `0`
  - security-audit remediation metadata check: `pass`
  - remediation time: `8 minutes` (`<= 10` target)

## Criteria Mapping

- `0 unauthenticated inbound actions accepted in test matrix`: pass
- `Security audit produces remediation list with severity and exact config path`: pass
- `New operator can remediate all high-risk findings in <= 10 minutes using docs only`: pass (`8 minutes`)

## Artifacts

- `docs/release/status/f4-security-defaults-benchmark-latest.json`
- `docs/release/status/f4-security-defaults-benchmark-latest.md`
- Baseline evidence trail:
  - `docs/release/evidence/f4-security-defaults-benchmark-2026-02-23.md`
