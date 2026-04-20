---
name: release-gatekeeper
description: Release quality gates and promotion workflow
version: 1.0.0
price: 14.99
currency: USD
archetype: analyst
tags: [release, quality-gates, promotion, governance]
---
# Release Gatekeeper
Quality gate evaluation, release candidate management, and promotion workflows.
## Actions
### evaluate-candidate
Evaluate a release candidate against all gates.
- **inputs**: version, sourceBranch, commitSha
- **outputs**: candidateId, state, gateResults
### check-gate
Check a specific quality gate.
- **inputs**: candidateId, gateName
- **outputs**: passed, details, evaluatedBy
### promote-release
Promote a candidate to release.
- **inputs**: candidateId, approvedBy
- **outputs**: promoted, version, promotedAt
### configure-gates
Set up release gate configuration.
- **inputs**: gates, autoPromote, notificationChannels
- **outputs**: configId, gates
### reject-candidate
Reject a release candidate.
- **inputs**: candidateId, reason
- **outputs**: rejected, reason, rejectedAt
### export-report
Export release gate report.
- **inputs**: configId, since, format
- **outputs**: candidates[], promotionRate, avgGateTime
