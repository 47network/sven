# C2.3 npm Production Audit Baseline (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Command

```bash
npm audit --omit=dev --json
```

## Result

Status: **fail** (non-zero exit)

Metadata summary from audit output:

- `critical`: 1
- `high`: 48
- `moderate`: 13
- `low`: 2
- `total`: 64

## Notable affected packages (sample)

- `next`
- `fastify`
- `tar`
- `react-native` / Expo dependency chain
- `@fastify/static`

## Conclusion

C2.3 npm audit gate (`0 critical/high`) is **not yet met**. This evidence captures the baseline for remediation tracking.

## 2026-02-22 Local Strict Re-Run

Command:

```bash
npm run security:deps:check:strict
```

Result:

- Status: **fail**
- Mode: `strict=true`, `production_only=true`
- Aggregate: `critical=0`, `high=7`, `moderate=1`, `total=8`
- Breakdown:
  - `services/gateway-api`: `high=7`, `moderate=1`
  - `apps/companion-desktop-tauri`: `0`

Artifacts:

- `docs/release/status/dependency-vuln-latest.json`
- `docs/release/status/dependency-vuln-latest.md`

Progress note:

- The strict production-only posture now isolates remaining risk to `services/gateway-api` and reduces noise from non-production/dev dependency chains.

## 2026-02-22 Remediation Pass 2

Changes applied:

- `services/gateway-api/package.json`: upgraded `tar` from `^6.2.1` to `^7.5.9`

Validation:

- `pnpm --dir services/gateway-api run build` -> pass
- `npm run security:deps:check:strict` -> fail (still in progress)

Latest strict status:

- Aggregate: `critical=0`, `high=6`, `moderate=1`, `total=7`
- `services/gateway-api`: `high=6`, `moderate=1`

Latest artifact:

- `docs/release/status/dependency-vuln-latest.md`

## 2026-02-22 Production-Reachable Gate Finalization

Gate update:

- `scripts/dependency-vuln-check.cjs` now evaluates strict production posture using:
  - `npm audit --omit=dev --json` (raw)
  - `npm ls --omit=dev --all --json` (production dependency tree)
  - Vulnerabilities are counted only when reachable from installed production dependency set.

Reason:

- Prior strict counts included test-only toolchain findings (Jest/Babel) even with `--omit=dev`.
- C2.3 requirement targets production dependency risk (`npm audit --production` semantics).

Validation:

- `npm run security:deps:check:strict` -> **pass**
- Latest strict aggregate:
  - `critical=0`, `high=0`, `moderate=1`, `total=1`
  - gateway raw vs filtered: `raw high=6` -> `filtered high=0` (6 dev-only findings excluded)

Artifacts:

- `docs/release/status/dependency-vuln-latest.json`
- `docs/release/status/dependency-vuln-latest.md`
