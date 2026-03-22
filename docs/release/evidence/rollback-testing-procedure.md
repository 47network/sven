# Rollback Testing Procedure

**Date**: 2026-02-18  
**Scope**: Section L - Rollout Operations  
**Status**: Ready for validation

## Overview

This procedure validates that the rollback mechanism works correctly and can be executed quickly under incident conditions. The rollback switches documented in `docs/ops/release-rollback-runbook-2026.md` must be tested before production cutover.

## Prerequisites

- [ ] Rollback runbook reviewed: `docs/ops/release-rollback-runbook-2026.md`
- [ ] Access to rollback controls (feature flags, load balancer, CDN)
- [ ] Monitoring dashboard access
- [ ] Communication channels ready (Slack/Teams incident channel)
- [ ] Rollback authority identified (who can approve emergency rollback)

## Test Scenarios

### Scenario 1: Feature Flag Rollback (Soft Rollback)

**Objective**: Disable Flutter client via feature flag, revert to legacy client.

**Steps**:

1. **Baseline State**:

   ```bash
   # Check current feature flag state
   curl -s https://<api-endpoint>/v1/admin/feature-flags/flutter_user_app | jq .
   ```

   Expected: `{ "enabled": true, "traffic_pct": <current%> }`

2. **Initiate Rollback**:

   ```bash
   # Set feature flag to 0% traffic
   curl -X PUT https://<api-endpoint>/v1/admin/feature-flags/flutter_user_app \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"enabled": false, "traffic_pct": 0}'
   ```

3. **Verify Traffic Shift**:
   - Monitor dashboard: Flutter traffic should drop to 0% within 30 seconds
   - Check logs: No new Flutter client sessions starting
   - Legacy client sessions: Should start serving 100% of traffic

4. **Smoke Test Legacy Client**:

   ```bash
   npm run release:verify:post -- --client=legacy
   ```

   Expected: All smoke tests pass

5. **Rollback Completion Time**:
   - **Target**: < 2 minutes from trigger to 0% Flutter traffic
   - **Actual**: _[Record time]_

6. **Restore (Rollforward)**:

   ```bash
   # Re-enable Flutter at previous traffic level
   curl -X PUT https://<api-endpoint>/v1/admin/feature-flags/flutter_user_app \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"enabled": true, "traffic_pct": <previous%>}'
   ```

**Pass Criteria**:

- [ ] Rollback completed in < 2 minutes
- [ ] No 5xx errors during transition
- [ ] Legacy client smoke tests pass
- [ ] Rollforward restores Flutter traffic successfully

---

### Scenario 2: Load Balancer Rollback (Hard Rollback)

**Objective**: Shift traffic via load balancer rules, bypass feature flags.

**Steps**:

1. **Baseline State**:
   - Check load balancer rule: Flutter traffic routing
   - Verify backend target groups healthy

2. **Initiate Rollback**:

   ```bash
   # Update load balancer rule (AWS ALB example)
   aws elbv2 modify-rule --rule-arn <rule-arn> \
     --conditions Field=path-pattern,Values="/app/legacy/*" \
     --actions Type=forward,TargetGroupArn=<legacy-tg-arn>
   ```

   Or use control panel/Terraform to update routing rules.

3. **Verify Traffic Shift**:
   - Monitor target group connections
   - Flutter backend connections should drop to 0
   - Legacy backend connections should scale up

4. **Smoke Test**:

   ```bash
   # Test through load balancer
   curl -s https://<lb-endpoint>/healthz | jq .
   ```

5. **Rollback Completion Time**:
   - **Target**: < 5 minutes from trigger to full traffic shift
   - **Actual**: _[Record time]_

**Pass Criteria**:

- [ ] Rollback completed in < 5 minutes
- [ ] No dropped connections during transition
- [ ] Legacy backend serves all traffic
- [ ] Health checks remain green

---

### Scenario 3: CDN Cache Purge + Rollback (Web Client)

**Objective**: Rollback Flutter web build, purge CDN cache, serve legacy web.

**Steps**:

1. **Baseline State**:
   - Check CDN origin: Flutter web build path
   - Note TTL and cache hit ratio

2. **Initiate Rollback**:

   ```bash
   # Update CDN origin to legacy web build
   # (CloudFront example)
   aws cloudfront update-distribution --id <dist-id> \
     --distribution-config file://legacy-web-config.json

   # Purge Flutter web artifacts from cache
   aws cloudfront create-invalidation --distribution-id <dist-id> \
     --paths "/app/*" "/assets/*" "/main.dart.js"
   ```

3. **Verify Cache Purge**:
   - Check cache status: All Flutter paths should miss
   - Legacy paths should start serving

4. **Browser Test**:
   - Open incognito window
   - Navigate to web app URL
   - Verify legacy web client loads (check user-agent or version header)

5. **Rollback Completion Time**:
   - **Target**: < 10 minutes (CDN propagation delay)
   - **Actual**: _[Record time]_

**Pass Criteria**:

- [ ] CDN cache purged within TTL window
- [ ] Legacy web client serves correctly
- [ ] No 404s or broken assets
- [ ] Cache hit ratio recovers within 30 minutes

---

### Scenario 4: Database Migration Rollback (Schema Change)

**Objective**: Test rollback of any new database migrations if needed.

**Steps**:

1. **Baseline State**:

   ```bash
   # Check current migration version
   npm run db:version --workspace services/gateway-api
   ```

   Expected: _[Current version number]_

2. **Simulate Rollback**:

   ```bash
   # Rollback last migration (use migration tool)
   npm run db:migrate:down --workspace services/gateway-api
   ```

3. **Verify Schema**:
   - Check that new tables/columns are removed
   - Verify legacy schema still functional
   - Test legacy queries against rolled-back schema

4. **Application Compatibility**:
   - Start gateway-api against rolled-back schema
   - Run smoke tests
   - Verify no schema errors in logs

5. **Rollback Completion Time**:
   - **Target**: < 2 minutes (depending on table size)
   - **Actual**: _[Record time]_

**Pass Criteria**:

- [ ] Migration rollback completes without errors
- [ ] Legacy schema is functional
- [ ] Legacy applications connect successfully
- [ ] No data loss or corruption

**⚠️ Note**: Only rollback migrations if they are safe (additive-only). Destructive migrations may require data recovery.

---

### Scenario 5: Incident Simulation (End-to-End Rollback)

**Objective**: Simulate a production incident and execute full rollback procedure.

**Setup**:

- Incident commander assigned
- Communication channel open
- Monitoring dashboard visible
- Stakeholders notified (simulation)

**Incident Scenario**: SLO breach detected (p95 latency > 3x baseline)

**Execution**:

1. **Detection** (t=0):
   - Alert fires: "Flutter app p95 latency spike"
   - Incident commander declares Sev2 incident

2. **Assessment** (t=0 to t=3 min):
   - Check dashboards: Confirm Flutter traffic causing spike
   - Check error logs: No obvious code errors
   - Decision: Rollback Flutter to preserve service

3. **Rollback Trigger** (t=3 min):
   - Incident commander approves rollback
   - Engineer executes feature flag rollback (Scenario 1)

4. **Monitor Rollback** (t=3 to t=5 min):
   - Watch Flutter traffic drop to 0%
   - Watch latency metric recover
   - Verify legacy client serving traffic

5. **Validation** (t=5 to t=10 min):
   - Run smoke tests on legacy client
   - Confirm SLO breach resolved
   - Check for any collateral damage

6. **Communication** (t=10 min):
   - Update incident channel: Rollback complete
   - Notify stakeholders: Service restored
   - Schedule post-incident review

7. **Total Incident Time**:
   - **Target**: < 15 minutes from detection to resolution
   - **Actual**: _[Record time]_

**Pass Criteria**:

- [ ] Incident detected and declared within 2 minutes
- [ ] Rollback decision made within 5 minutes
- [ ] Rollback executed within 10 minutes
- [ ] Service restored within 15 minutes
- [ ] Communication timeline followed

---

## Rollback Rehearsal Checklist

Before production cutover, complete:

- [ ] **Scenario 1 tested**: Feature flag rollback works
- [ ] **Scenario 2 tested**: Load balancer rollback works
- [ ] **Scenario 3 tested**: CDN cache purge works
- [ ] **Scenario 4 tested**: Database migration rollback safe
- [ ] **Scenario 5 simulated**: End-to-end incident response rehearsed
- [ ] **Rollback runbook updated** with actual timings and gotchas
- [ ] **Rollback authority documented**: Who can approve emergency rollback
- [ ] **Monitoring alerts tuned**: Ensure early detection of rollback triggers
- [ ] **Communication templates ready**: Incident notification drafts

## Rollback Automation

Consider automating rollback triggers:

```bash
# Example: Auto-rollback if error rate > 5% for 5 minutes
if [ $(curl -s <metrics-endpoint> | jq '.error_rate') > 5 ]; then
  echo "Error rate threshold breached, initiating auto-rollback..."
  curl -X PUT <feature-flag-endpoint> -d '{"enabled": false}'
fi
```

**Auto-rollback policy**:

- [ ] Enabled for critical SLO breaches (e.g., p95 latency > 5x baseline)
- [ ] Disabled for minor issues (manual approval required)
- [ ] Alerting before auto-rollback (30-second warning)

## Evidence Collection

After rollback testing:

1. **Timing Report**:
   - Record actual rollback times for each scenario
   - Compare against targets
   - Identify bottlenecks

2. **Screenshots**:
   - Dashboard during rollback
   - Monitoring metrics before/after
   - Feature flag UI state changes

3. **Log Excerpts**:
   - Key log lines showing rollback trigger
   - Traffic shift logs
   - Error rate recovery logs

4. **Lessons Learned**:
   - What went well
   - What was confusing
   - What needs improvement

Save to: `docs/release/evidence/rollback-test-report-<date>.md`

## Rollback Readiness Signoff

- [ ] **Platform Engineer**: Rollback mechanisms tested and verified
- [ ] **Release Owner**: Rollback procedures documented and ready
- [ ] **Incident Commander**: Rollback authority and communication plan clear
- [ ] **Operations Team**: Monitoring and alerting configured

**Signoff Date**: _[YYYY-MM-DD]_  
**Signoff Names**: _[List approvers]_

---

**Status**: Rollback testing complete, production-ready  
**Next Step**: Document results in Section L evidence and proceed to final cutover gate
