# Canary Phase 0: Internal Dogfood Evidence

**Phase**: Internal Dogfood  
**Date Started**: _[YYYY-MM-DD HH:MM UTC]_  
**Date Completed**: _[YYYY-MM-DD HH:MM UTC]_  
**Duration**: _[XX minutes]_  
**Status**: _[In Progress | Pass | Fail]_

## Cohort Configuration

- **Target**: Internal operators and test accounts only
- **Traffic %**: 0% (manual access only)
- **Participants**: _[List test accounts/operators]_
- **Build/Version**: _[version tag or commit SHA]_
- **Environment**: _[staging | pre-prod | production-isolated]_

## Test Scenarios

### Auth and Session

- [ ] Login flow completes successfully
- [ ] Token refresh works without re-login
- [ ] Logout clears session properly
- [ ] Session restore on cold start works

### Chat Experience

- [ ] Create new chat
- [ ] Send message and receive response
- [ ] Streaming messages render correctly
- [ ] Retry after error works
- [ ] Reconnect after network drop works

### Approvals Workflow

- [ ] Approval request appears in UI
- [ ] Approve action succeeds
- [ ] Deny action succeeds
- [ ] Approval timeout behavior correct

### Notifications

- [ ] Push notification received (if configured)
- [ ] Notification tap opens correct screen
- [ ] Deep link routing works

### Settings and Preferences

- [ ] Switch visual mode (cinematic ↔ classic)
- [ ] Change motion level (off/reduced/full)
- [ ] Change avatar mode (orb/robot/human/animal)
- [ ] Preferences persist across app restarts

### Error Handling

- [ ] Network offline state displayed correctly
- [ ] Backend 5xx error shows degraded mode
- [ ] Auth 401/403 triggers session recovery
- [ ] Rate limit 429 shows appropriate message

## Issues Discovered

| ID | Severity | Description | Status | Notes |
|----|----------|-------------|--------|-------|
| _[#001]_ | _[Sev1/2/3]_ | _[Brief description]_ | _[Open/Fixed/Deferred]_ | _[Context]_ |

## Metrics Observed

### Performance

- Cold start times: _[p50, p95, p99]_
- Warm resume times: _[p50, p95, p99]_
- First token latency: _[p50, p95, p99]_
- Frame rate: _[AVG FPS, % janky frames]_

### Stability

- Crashes: _[count]_
- ANRs: _[count]_
- Error rate: _[%]_
- Session failures: _[count]_

### Functional

- Successful logins: _[count]_
- Messages sent: _[count]_
- Approvals processed: _[count]_
- Notifications delivered: _[count]_

## Health Check Results

```bash
# Gateway API health
curl -s https://<endpoint>/healthz | jq .

# Auth service health
curl -s https://<endpoint>/v1/auth/status | jq .
```

**Results**:

- [ ] All services report healthy
- [ ] Database connections stable
- [ ] Queue depths normal
- [ ] No elevated error rates

## Logs and Telemetry

**Key log entries** (attach or summarize):

- Auth events: _[summary]_
- Chat events: _[summary]_
- Error/warning patterns: _[summary]_

**Telemetry events captured**:

- startup.cold_start: _[N samples]_
- chat.stream.first_token: _[N samples]_
- approval.action: _[N samples]_

## Triage and Resolution

### High Priority Issues

_[List any Sev1/Sev2 issues and their disposition]_

### Deferred Items

_[List any non-blocking issues for future releases]_

## Gate Decision

- [ ] **PASS**: No blocking issues, proceed to Phase 1 (5% canary)
- [ ] **FAIL**: Critical issues found, fix required before proceeding
- [ ] **HOLD**: Non-critical issues, requires stakeholder approval to proceed

**Approver**: _[Name]_  
**Approval Timestamp**: _[YYYY-MM-DD HH:MM UTC]_

## Notes

_[Any additional observations, context, or recommendations]_

---

**Next Step**: If PASS, proceed to Phase 1 (5% canary) using `canary-phase1-evidence-template.md`
