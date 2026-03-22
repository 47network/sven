# Canary Phase 1: 5% Canary Evidence

**Phase**: 5% Public Canary  
**Date Started**: _[YYYY-MM-DD HH:MM UTC]_  
**Date Completed**: _[YYYY-MM-DD HH:MM UTC]_  
**Duration**: _[60 minutes minimum]_  
**Status**: _[In Progress | Pass | Fail]_

## Rollout Configuration

- **Target**: 5% of production traffic
- **Selection**: _[Random | Cohort-based | Geographic]_
- **Build/Version**: _[version tag or commit SHA]_
- **Rollout Mechanism**: _[Feature flag | Load balancer | CDN rule]_
- **Rollback Plan**: _[Quick rollback trigger documented]_

## SLO Monitoring

Reference: `docs/release/status/post-release-verification-latest.md`

### Auth SLOs

- [ ] Login success rate ≥ 99.5%
- [ ] Token refresh latency p95 ≤ 500ms
- [ ] Session restore success rate ≥ 99%

### Chat SLOs

- [ ] Message send success rate ≥ 99%
- [ ] First token latency p95 ≤ 1.5s
- [ ] Streaming completion rate ≥ 99%

### Approval SLOs

- [ ] Approval action success rate ≥ 99.5%
- [ ] Approval notification latency p95 ≤ 2s

### Infrastructure SLOs

- [ ] API p95 latency ≤ 200ms
- [ ] Error rate ≤ 0.5%
- [ ] healthz/readyz all green
- [ ] Queue depth within normal bounds

## Observability Dashboard Checks

Run automated dashboard SLO check:

```bash
npm run release:admin:dashboard:slo:auth
```

**Pass criteria**:

- All SLO checks green
- No elevated error rates
- No resource exhaustion signals

## Error Budget Status

**Pre-rollout budget**: _[X% remaining]_  
**Current budget**: _[Y% remaining]_  
**Budget consumed**: _[Z%]_  

**Budget breach**: _[Yes | No]_

If budget breached:

- [ ] Incident declared
- [ ] Rollback initiated
- [ ] Root cause analysis started

## Incident Log

| Time | Severity | Description | Action Taken | Resolved |
|------|----------|-------------|--------------|----------|
| _[HH:MM]_ | _[Sev1/2/3]_ | _[Brief description]_ | _[Action]_ | _[Y/N]_ |

## User Feedback

**Support tickets opened**: _[count]_  
**Severity breakdown**:

- Sev1: _[count]_
- Sev2: _[count]_
- Sev3: _[count]_

**Common themes**:

- _[Issue pattern 1]_
- _[Issue pattern 2]_

## Smoke Test Results

Run post-release verification:

```bash
npm run release:verify:post
```

**Results**:

- [ ] Auth smoke tests pass
- [ ] Chat smoke tests pass
- [ ] Approval smoke tests pass
- [ ] Deep link smoke tests pass

## Metrics Comparison (5% Canary vs. Baseline)

| Metric | Baseline | Canary | Delta | Status |
|--------|----------|--------|-------|--------|
| Cold start p95 | _[Xms]_ | _[Yms]_ | _[±Z%]_ | ✅/⚠️/❌ |
| First token p95 | _[Xms]_ | _[Yms]_ | _[±Z%]_ | ✅/⚠️/❌ |
| Error rate | _[X%]_ | _[Y%]_ | _[±Z%]_ | ✅/⚠️/❌ |
| Crash rate | _[X%]_ | _[Y%]_ | _[±Z%]_ | ✅/⚠️/❌ |

**Pass criteria**: No regressions > 10% from baseline

## Rollback Trigger Evaluation

Refer to: `docs/ops/release-rollback-runbook-2026.md`

**Rollback triggers**:

- [ ] SLO breach sustained for 10+ minutes
- [ ] Error rate spike > 3x baseline
- [ ] Crash rate spike > 2x baseline
- [ ] Data integrity issue detected
- [ ] Security vulnerability discovered

**Rollback initiated**: _[Yes | No]_  
**Rollback reason**: _[N/A or description]_

## Gate Decision

- [ ] **PASS**: SLOs met, no critical issues, proceed to Phase 2 (25% canary)
- [ ] **FAIL**: SLO breach or critical incidents, rollback and fix
- [ ] **HOLD**: Near-breach or minor issues, hold for extended observation

**Approver**: _[Name]_  
**Approval Timestamp**: _[YYYY-MM-DD HH:MM UTC]_

## Notes

_[Any additional observations, context, or recommendations]_

---

**Next Step**: If PASS, proceed to Phase 2 (25% canary) using `canary-phase2-evidence-template.md`
