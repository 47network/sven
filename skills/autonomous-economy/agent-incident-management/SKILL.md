---
skill: agent-incident-management
name: Agent Incident Management
version: 1.0.0
description: Detect, triage, escalate, and resolve incidents across the agent ecosystem with automated runbooks and postmortem analysis
category: autonomous-economy
archetype: architect
pricing:
  model: per_action
  base_cost: 0
tags:
  - incident
  - monitoring
  - escalation
  - runbook
  - postmortem
  - reliability
inputs:
  - name: incidentData
    type: object
    description: Incident details including severity, affected service, and impact scope
  - name: runbookId
    type: string
    description: Runbook identifier for automated remediation
  - name: escalationLevel
    type: number
    description: Target escalation level for the incident
outputs:
  - name: result
    type: object
    description: Incident management action result with status and timeline
---

# Agent Incident Management

Comprehensive incident lifecycle management for the autonomous agent ecosystem — from detection and triage through escalation, remediation, resolution, and postmortem analysis.

## Actions

### Create Incident
Create a new incident with severity classification, impact assessment, and automatic assignment.
- **action**: `incident_create`
- **inputs**: title, description, severity, source, affectedService, affectedAgentId, impactScope
- **outputs**: incident object with id, initial timeline entry

### Triage Incident
Assess and classify an incident, assign priority, and determine initial response.
- **action**: `incident_triage`
- **inputs**: incidentId, severity override, priority, assignedAgentId, notes
- **outputs**: updated incident with triage assessment

### Escalate Incident
Escalate an incident to a higher response level with notification routing.
- **action**: `incident_escalate`
- **inputs**: incidentId, toLevel, reason, escalatedTo
- **outputs**: escalation record, updated timeline

### Execute Runbook
Execute an automated or semi-automated runbook for incident remediation.
- **action**: `incident_run_runbook`
- **inputs**: incidentId, runbookId, parameters
- **outputs**: execution result, steps completed, success/failure status

### Resolve Incident
Mark an incident as resolved with root cause and resolution details.
- **action**: `incident_resolve`
- **inputs**: incidentId, rootCause, resolution, preventionMeasures
- **outputs**: resolved incident, resolution timeline entry

### Generate Postmortem
Create a structured postmortem document with timeline, root cause analysis, and action items.
- **action**: `incident_postmortem`
- **inputs**: incidentId, summary, rootCauseAnalysis, contributingFactors, lessonsLearned
- **outputs**: postmortem document with action items and prevention measures

### Incident Report
Generate incident analytics and reliability metrics across the platform.
- **action**: `incident_report`
- **inputs**: timeRange, severityFilter, serviceFilter, groupBy
- **outputs**: MTTR, incident counts by severity, top affected services, trend analysis
