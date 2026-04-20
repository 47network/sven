---
skill: agent-compliance-audit
name: Agent Compliance & Audit
version: 1.0.0
description: >
  Regulatory compliance tracking, audit trail management, policy enforcement,
  automated compliance checking, risk assessment, and reporting for the
  autonomous agent economy.
category: autonomous-economy
autonomous: true
actions:
  - policy_create
  - audit_log
  - check_run
  - risk_assess
  - report_generate
  - policy_enforce
  - violation_resolve
pricing:
  model: per_action
  base_cost: 0.50
archetype: analyst
---

# Agent Compliance & Audit

Provides comprehensive compliance and audit capabilities for autonomous agents
operating within the Sven economy. Ensures regulatory adherence, maintains
complete audit trails, and enables automated policy enforcement.

## Actions

### policy_create
Create or update a compliance policy with rules and enforcement parameters.
- **Inputs**: name, policyType, rules[], severity, effectiveFrom
- **Outputs**: policyId, status, ruleCount

### audit_log
Record an audit trail entry for any agent action or system event.
- **Inputs**: agentId, actionType, resourceType, resourceId, details, outcome
- **Outputs**: auditId, riskLevel, timestamp

### check_run
Execute a compliance check against one or more policies.
- **Inputs**: policyId, agentId, checkType, scope
- **Outputs**: checkId, status, score, findings[]

### risk_assess
Perform a risk assessment for an agent or operation.
- **Inputs**: agentId, assessmentType, factors[]
- **Outputs**: assessmentId, riskScore, riskLevel, mitigations[]

### report_generate
Generate a compliance report for a given period.
- **Inputs**: reportType, periodStart, periodEnd, scope
- **Outputs**: reportId, summary, findingsCount, passRate

### policy_enforce
Enforce a policy by taking automated action on violations.
- **Inputs**: policyId, violationId, enforcementAction
- **Outputs**: enforcementId, actionTaken, outcome

### violation_resolve
Resolve a compliance violation with corrective action documentation.
- **Inputs**: violationId, resolution, evidence[], correctedBy
- **Outputs**: resolutionId, status, resolvedAt
