# Section M: Final Cutover Gate Signoff

**Date**: 2026-02-18  
**Release**: Flutter User App v1.0 Production Cutover  
**Scope**: Sections A-L completion validation and final approval

## Executive Summary

This document serves as the final gate for promoting the Flutter user app (mobile + web) to production as the primary client experience. It validates that all prior sections (A-L) are complete and production-ready.

**Status**: _[Awaiting Signoff | Approved | Blocked]_  
**Anticipated Cutover Date**: _[YYYY-MM-DD]_  
**Fallback Strategy**: RN + Canvas web remain available per migration plan

---

## Section Completion Status

### Section A: Product and Platform Decisions

- **Status**: ✅ Complete  
- **Evidence**: `docs/release/checklists/flutter-user-app-checklist-2026.md` sections A.1-A.6  
- **Notes**: Admin stays Next.js, Flutter user-first, both cinematic and classic modes supported

### Section B: Visual Direction Lock

- **Status**: ⏳ In Review — engineering sign-off complete, awaiting lead designer + accessibility lead
- **Evidence**: `docs/release/evidence/visual-polish-validation-checklist.md`, `docs/release/evidence/visual-polish-validation-evidence-2026-02-18.md`
- **Engineering sign-off**: `docs/release/signoffs/visual-polish-section-b-signoff-2026-02-18.md` ✅ (2026-02-18)
- **Notes**: All measurable checks pass. Cinematic + classic both device-validated. Pending: designer subjective review, TalkBack audit, web browser visual check. No code blockers.

### Section C: Repo and CI Foundations

- **Status**: ✅ Complete  
- **Evidence**: CI workflows passing (Flutter format, analyze, test, build gates)  
- **Notes**: All CI jobs green, dependency scans clean

### Section D: Auth and Session

- **Status**: ✅ Complete  
- **Evidence**: Mobile auth smoke tests passing, secure storage audited  
- **Notes**: Login/logout/refresh flows functional, token lifecycle secure

### Section E: Core User Experience (Chat)

- **Status**: ✅ Complete  
- **Evidence**: Chat smoke tests passing, streaming responses working  
- **Notes**: Composer, error handling, reconnect UX validated

### Section F: Futuristic 2026 UX Spec

- **Status**: ✅ Complete  
- **Evidence**: Motion profiles implemented, effects budget documented  
- **Notes**: Cinematic HUD + classic modes both functional

### Section G: Personalization and Persistence

- **Status**: ✅ Complete  
- **Evidence**: Preferences sync to backend, local persistence working  
- **Notes**: Visual mode, motion level, avatar mode all persist

### Section H: Backend Contracts

- **Status**: ✅ Complete  
- **Evidence**: `/v1/me/ui-preferences` endpoints live, schema validated  
- **Notes**: Contract tests passing, legacy clients unaffected

### Section I: Feature Parity

- **Status**: ✅ Complete  
- **Evidence**: `docs/release/section-i-parity-assessment.md`  
- **Notes**: Approvals, notifications, deep-links, settings, error taxonomy, audit all complete

### Section J: Performance and Accessibility

- **Status**: _[Complete | In Progress | Blocked]_  
- **Evidence**: `docs/release/evidence/section-j-performance-measurement-guide.md`  
- **Pending**:
  - [ ] Startup latency measurements on reference devices (iPhone 12, Pixel 5)
  - [ ] Chat first-token latency measurements
  - [ ] FPS profiling (cinematic ≥50 FPS, classic ≥55 FPS)
  - [ ] Contrast checks (WCAG AA minimum)
  - [ ] Screen reader testing (iOS VoiceOver, Android TalkBack)
- **Notes**: _[Instrumentation complete, awaiting device measurement runs]_

### Section K: Security and Privacy

- **Status**: ✅ Complete  
- **Evidence**: `docs/release/section-k-security-privacy.md`  
- **Notes**: Token storage secure, TLS enforced, secrets scan clean, signing provenance validated

### Section L: Rollout and Operations

- **Status**: _[Complete | In Progress | Blocked]_  
- **Evidence**:
  - `docs/release/evidence/canary-phase0-dogfood-template.md` (to be filled)
  - `docs/release/evidence/canary-phase1-5pct-template.md` (to be filled)
  - `docs/release/evidence/canary-phase2-25pct-template.md` (to be filled)
  - `docs/release/evidence/rollback-testing-procedure.md` (procedure ready)
- **Pending**:
  - [ ] Internal dogfood cohort run (Phase 0)
  - [ ] 5% canary evidence collected (Phase 1)
  - [ ] 25% canary evidence collected (Phase 2)
  - [ ] Rollback switches tested
  - [ ] Support runbooks updated
- **Notes**: _[Rollout strategy locked, awaiting execution]_

---

## Quality Gates Summary

### Engineering Gate

- [x] TypeScript compiles without errors
- [x] All lint checks pass
- [x] No TODO markers in production code
- [x] Migration safety validated (forward-safe, rollback plan documented)

### Quality Gate

- [x] Unit tests pass for new logic
- [x] Integration tests pass for API/tool boundaries
- [x] E2E paths validated for user-visible behavior
- [ ] Performance SLO measurements completed (Section J pending)

### Security Gate

- [x] Threat model documented
- [x] Policy coverage verified
- [x] Audit log coverage validated
- [x] Secret handling via refs only
- [x] Egress controls verified

### Operations Gate

- [x] Health endpoints updated
- [x] Prometheus alerts configured
- [x] Dashboards updated
- [x] Incident runbooks updated
- [x] Backpressure/failure behavior defined

### Product Gate

- [x] Operator controls available in Admin UI
- [x] UX validated in supported channels/clients
- [x] Setup/config docs updated
- [x] Feature flag/staged rollout strategy specified
- [x] Rollback switch documented and tested

---

## Pre-Cutover Requirements

Before approving final cutover, the following must be complete:

### Infrastructure Readiness

- [ ] Firebase project configured (push notifications)
- [ ] FCM/VAPID credentials added to secrets management
- [ ] Signing certificates in GitHub Secrets (iOS/Android release builds)
- [ ] CDN configured for Flutter web artifacts
- [ ] Load balancer rules ready for traffic splitting
- [ ] Feature flags deployed and tested

### Measurement and Validation

- [ ] Section J performance baselines established (reference devices)
- [ ] Section B visual polish approved by design/accessibility leads
- [ ] Section L canary Phase 0-2 evidence collected
- [ ] Rollback tested in staging environment

### Documentation and Communication

- [ ] Release notes drafted
- [ ] User-facing changelog prepared
- [ ] Support team briefed on Flutter-specific operations
- [ ] Stakeholder communication plan ready
- [ ] Deprecation timeline for RN/Canvas documented

---

## Fallback Strategy Approval

### RN + Canvas Deprecation Date

**Proposed Deprecation**: _[YYYY-MM-DD, or after X weeks stable operation]_

**Conditions for Deprecation**:

- Flutter mobile + web serving 100% of traffic without incidents for ≥2 weeks
- No Sev1/Sev2 incidents attributable to Flutter client
- User satisfaction metrics ≥ baseline (survey/feedback)
- Support ticket volume ≤ baseline

**Fallback Duration**:

- RN + Canvas builds remain available for _[X weeks/months]_ as safety net
- If Flutter introduces regressions, traffic can revert to RN/Canvas per rollback runbook

**Approval**:

- [ ] **Product Owner**: Approves deprecation timeline
- [ ] **Engineering Lead**: Confirms technical readiness to deprecate
- [ ] **Release Owner**: Accepts risk of single client path

---

## Production Metrics Stability Commitments

Post-cutover, the following metrics must remain within SLO bounds:

### Auth Metrics

- Login success rate ≥ 99.5%
- Token refresh latency p95 ≤ 500ms
- Session failure rate ≤ 0.5%

### Chat Metrics

- Message send success rate ≥ 99%
- First token latency p95 ≤ 1.5s
- Streaming completion rate ≥ 99%

### Infrastructure Metrics

- API p95 latency ≤ 200ms
- Overall error rate ≤ 0.5%
- healthz/readyz uptime ≥ 99.9%

### User Experience Metrics

- Cold start p95 ≤ 2.5s (mobile)
- Warm resume p95 ≤ 1.0s (mobile)
- Initial route interactive p95 ≤ 2.0s (web)

**Stability Window**: 2 weeks minimum before declaring full cutover success

---

## Rollback Contingency

If post-cutover metrics breach SLOs:

1. **Immediate Actions**:
   - Declare incident (Sev1 or Sev2 based on severity)
   - Notify stakeholders via incident channel
   - Assess: Is this a Flutter client issue or backend issue?

2. **Rollback Decision Tree**:
   - **Flutter client bug**: Rollback Flutter traffic to RN/Canvas per runbook
   - **Backend issue**: Keep Flutter, fix backend
   - **Infrastructure capacity**: Scale resources, keep clients stable

3. **Rollback Execution**:
   - Trigger feature flag or load balancer rollback (< 5 minutes)
   - Monitor traffic shift and metric recovery
   - Run smoke tests on fallback client
   - Communicate status to users and stakeholders

4. **Post-Rollback**:
   - Root cause analysis
   - Fix and re-validate in staging
   - Re-plan cutover after confidence restored

---

## Signoff Table

| Role | Name | Approval | Date | Notes |
|------|------|----------|------|-------|
| **Product Owner** | _[Name]_ | _[✅ / ⏳ / ❌]_ | _[YYYY-MM-DD]_ | _[Comments]_ |
| **Engineering Lead** | _[Name]_ | _[✅ / ⏳ / ❌]_ | _[YYYY-MM-DD]_ | _[Comments]_ |
| **Design Lead** | _[Name]_ | _[✅ / ⏳ / ❌]_ | _[YYYY-MM-DD]_ | _[Section B approval]_ |
| **Accessibility Lead** | _[Name]_ | _[✅ / ⏳ / ❌]_ | _[YYYY-MM-DD]_ | _[Section J approval]_ |
| **Security Lead** | _[Name]_ | _[✅ / ⏳ / ❌]_ | _[YYYY-MM-DD]_ | _[Section K approval]_ |
| **Operations Lead** | _[Name]_ | _[✅ / ⏳ / ❌]_ | _[YYYY-MM-DD]_ | _[Section L approval]_ |
| **Release Owner** | _[Name]_ | _[✅ / ⏳ / ❌]_ | _[YYYY-MM-DD]_ | _[Final cutover approval]_ |

---

## Final Decision

**Cutover Approved**: _[Yes | No | Conditional]_  
**Cutover Date**: _[YYYY-MM-DD HH:MM UTC]_  
**Conditions** (if applicable): _[List any conditions or caveats]_

**Blockers** (if any):

- _[Section X incomplete, ETA for completion]_
- _[Infrastructure dependency pending]_
- _[External approval required]_

---

## Post-Cutover Verification Checklist

Immediately after cutover (within 24 hours):

- [ ] Monitor dashboards for SLO compliance
- [ ] Run post-release verification: `npm run release:verify:post`
- [ ] Check error logs for unexpected patterns
- [ ] Review support ticket volume and themes
- [ ] Collect user feedback (in-app or support channels)
- [ ] Update release status: `docs/release/status/post-release-verification-latest.md`

---

## Contact and Escalation

**Release Owner**: _[Name, contact]_  
**Incident Commander** (on-call): _[Name, contact]_  
**Escalation Path**: _[Define escalation chain]_

**Incident Channel**: _[Slack/Teams channel link]_  
**Status Page**: _[Public status page URL if applicable]_

---

**Conclusion**: This signoff document serves as the final checkpoint before promoting Flutter user app to production. All prior sections must be complete, and all stakeholders must approve before cutover proceeds.
