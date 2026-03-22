# Canary Phase 2: 25% Canary Evidence

**Phase**: 25% Public Canary  
**Date Started**: _[YYYY-MM-DD HH:MM UTC]_  
**Date Completed**: _[YYYY-MM-DD HH:MM UTC]_  
**Duration**: _[120 minutes minimum]_  
**Status**: _[In Progress | Pass | Fail]_

## Rollout Configuration

- **Target**: 25% of production traffic
- **Expansion From**: Phase 1 (5% canary)
- **Build/Version**: _[version tag or commit SHA]_
- **Rollout Mechanism**: _[Feature flag | Load balancer | CDN rule]_
- **Rollback Plan**: _[Quick rollback to 5% or 0%]_

## SLO Monitoring (Extended Observation)

Reference: `docs/release/status/post-release-verification-latest.md`

### Auth SLOs (2-hour window)

- [ ] Login success rate ≥ 99.5%
- [ ] Token refresh latency p95 ≤ 500ms
- [ ] Session restore success rate ≥ 99%
- [ ] No auth-related Sev1/Sev2 incidents

### Chat SLOs (2-hour window)

- [ ] Message send success rate ≥ 99%
- [ ] First token latency p95 ≤ 1.5s
- [ ] Streaming completion rate ≥ 99%
- [ ] No chat-related Sev1/Sev2 incidents

### Approval SLOs (2-hour window)

- [ ] Approval action success rate ≥ 99.5%
- [ ] Approval notification latency p95 ≤ 2s
- [ ] No approval workflow failures

### Infrastructure SLOs (2-hour window)

- [ ] API p95 latency ≤ 200ms (sustained)
- [ ] Error rate ≤ 0.5% (sustained)
- [ ] healthz/readyz all green (no flapping)
- [ ] Queue depth stable (no growth trend)
- [ ] Database connection pool healthy
- [ ] Memory/CPU within normal operating range

## Scale Testing Observations

With 25% traffic, monitor for:

### Resource Utilization

- **CPU**: _[Current avg%, peak%]_
- **Memory**: _[Current MB, peak MB]_
- **Disk I/O**: _[Read/write IOPS]_
- **Network**: _[Ingress/egress Mbps]_

### Backend Services

- **gateway-api**: _[healthy | degraded | down]_
- **agent-runtime**: _[healthy | degraded | down]_
- **skill-runner**: _[healthy | degraded | down]_
- **notification-service**: _[healthy | degraded | down]_
- **database**: _[healthy | degraded | down]_

### Queue and Job Processing

- **NATS queue depth**: _[count]_
- **Job processing rate**: _[jobs/min]_
- **Job failure rate**: _[%]_

## Error Budget Status

**Phase 1 remaining budget**: _[X%]_  
**Current remaining budget**: _[Y%]_  
**Phase 2 budget consumed**: _[Z%]_  

**Budget breach**: _[Yes | No]_

If budget breached:

- [ ] Incident declared
- [ ] Rollback to 5% initiated
- [ ] Root cause analysis started
- [ ] Phase 3 blocked pending fix

## Incident Log

| Time | Severity | Description | Action Taken | Resolved | Impact |
|------|----------|-------------|--------------|----------|--------|
| _[HH:MM]_ | _[Sev1/2/3]_ | _[Brief description]_ | _[Action]_ | _[Y/N]_ | _[User impact]_ |

## User Feedback (Cumulative)

**Support tickets opened (Phase 2)**: _[count]_  
**Severity breakdown**:

- Sev1: _[count]_
- Sev2: _[count]_
- Sev3: _[count]_

**Trending issues**:

- _[Issue pattern with increasing frequency]_
- _[Any new patterns not seen in Phase 1]_

## Smoke Test Results (Repeated)

Run post-release verification again to ensure stability:

```bash
npm run release:verify:post
```

**Results**:

- [ ] Auth smoke tests pass (100% success rate)
- [ ] Chat smoke tests pass (100% success rate)
- [ ] Approval smoke tests pass (100% success rate)
- [ ] Deep link smoke tests pass (100% success rate)

## Metrics Comparison (25% Canary vs. Phase 1 vs. Baseline)

| Metric | Baseline | Phase1 (5%) | Phase2 (25%) | Delta | Status |
|--------|----------|-------------|--------------|-------|--------|
| Cold start p95 | _[Xms]_ | _[Yms]_ | _[Zms]_ | _[±%]_ | ✅/⚠️/❌ |
| First token p95 | _[Xms]_ | _[Yms]_ | _[Zms]_ | _[±%]_ | ✅/⚠️/❌ |
| Error rate | _[X%]_ | _[Y%]_ | _[Z%]_ | _[±%]_ | ✅/⚠️/❌ |
| Crash rate | _[X%]_ | _[Y%]_ | _[Z%]_ | _[±%]_ | ✅/⚠️/❌ |
| Memory (p95) | _[XMB]_ | _[YMB]_ | _[ZMB]_ | _[±%]_ | ✅/⚠️/❌ |

**Pass criteria**: No regressions > 10% from Phase 1

## A/B Comparison (Flutter vs. Baseline)

If A/B testing enabled between Flutter and legacy clients:

| Metric | Legacy | Flutter | Delta | Significance |
|--------|--------|---------|-------|--------------|
| Session duration | _[Xmin]_ | _[Ymin]_ | _[±%]_ | _[p-value]_ |
| Messages/session | _[X]_ | _[Y]_ | _[±%]_ | _[p-value]_ |
| Bounce rate | _[X%]_ | _[Y%]_ | _[±%]_ | _[p-value]_ |
| User satisfaction | _[X/5]_ | _[Y/5]_ | _[±]_ | _[survey n=]_ |

## Rollback Trigger Evaluation

Refer to: `docs/ops/release-rollback-runbook-2026.md`

**Rollback triggers**:

- [ ] SLO breach sustained for 15+ minutes
- [ ] Error rate spike > 3x baseline
- [ ] Crash rate spike > 2x baseline
- [ ] Memory leak detected (trending growth)
- [ ] Database connection pool exhaustion
- [ ] Data integrity issue detected
- [ ] Security vulnerability discovered

**Rollback initiated**: _[Yes | No]_  
**Rollback target**: _[5% | 0%]_  
**Rollback reason**: _[N/A or description]_

## Capacity Headroom Check

Ensure infrastructure can sustain 100% rollout:

- [ ] CPU headroom ≥ 30% under peak load
- [ ] Memory headroom ≥ 25% under peak load
- [ ] Database connections ≤ 60% of pool max
- [ ] Disk I/O ≤ 70% of provisioned IOPS
- [ ] Network bandwidth ≤ 60% of capacity

**Capacity bottleneck identified**: _[Yes | No]_  
**Mitigation plan**: _[N/A or plan]_

## Gate Decision

- [ ] **PASS**: All SLOs met, no Sev1/Sev2 incidents, proceed to Phase 3 (100%)
- [ ] **FAIL**: SLO breach or critical incidents, rollback and fix
- [ ] **HOLD**: Borderline metrics or unresolved issues, extend observation
- [ ] **DEFER**: External factors (holidays, maintenance), postpone expansion

**Approver**: _[Name]_  
**Approval Timestamp**: _[YYYY-MM-DD HH:MM UTC]_

## Notes

_[Any additional observations, context, or recommendations for 100% rollout]_

---

**Next Step**: If PASS, proceed to Phase 3 (100% gradual rollout) and complete final cutover
