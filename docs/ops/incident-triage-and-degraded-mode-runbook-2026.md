# Incident Triage and Degraded Mode Runbook (2026)

Date: 2026-02-14

## 1. Triage Entry Conditions

- User-reported severe failures on auth/chat/approvals/admin operations.
- Automated alert from error-rate, latency, or availability thresholds.
- Failed release gate checks (`dashboard-slo`, `performance-capacity`, `soak`).

## 2. First 10 Minutes

1. Confirm blast radius:
- `GET /healthz`, `GET /readyz`
- Admin metrics summary endpoint

2. Confirm auth plane:
- admin login and session cookie issuance
- check approval and incident-status endpoints

3. Capture evidence:
- timestamped status artifacts in `docs/release/status/*.json`
- recent deployment/infra change references

## 3. Degraded Mode Actions

1. Reduce non-critical load:
- pause heavy jobs/indexing where applicable
- prioritize auth/chat/approval endpoints

2. Activate protective controls if needed:
- backpressure activation
- incident mode toggles through admin incident endpoints

3. Communicate status:
- affected surface(s), current impact, ETA for next update

## 4. Recovery Verification

1. Run checks:
- `release:admin:dashboard:slo:auth`
- `release:performance:capacity:auth`
- `release:privacy:compliance:auth` (if privacy-sensitive incident)

2. Confirm sustained pass window before clearing incident.

## 5. Post-Incident

- Create incident summary and root cause entry.
- Add prevention tasks to backlog with owners.
- Update thresholds/runbook if false positives or blind spots were found.
