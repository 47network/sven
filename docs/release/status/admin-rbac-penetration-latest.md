# Admin RBAC Penetration Check

Generated: 2026-03-21T02:11:45.480Z
Status: fail
API: https://app.sven.systems:44747

## Checks
- [ ] unauth_denied:/v1/admin/approvals?status=pending&per_page=5: fetch failed
- [ ] forged_session_denied:/v1/admin/approvals?status=pending&per_page=5: fetch failed
- [ ] unauth_denied:/v1/admin/runs?per_page=5: fetch failed
- [ ] forged_session_denied:/v1/admin/runs?per_page=5: fetch failed
- [ ] unauth_denied:/v1/admin/incident/status: fetch failed
- [ ] forged_session_denied:/v1/admin/incident/status: fetch failed
- [ ] unauth_denied:/v1/admin/performance/metrics/summary: fetch failed
- [ ] forged_session_denied:/v1/admin/performance/metrics/summary: fetch failed
