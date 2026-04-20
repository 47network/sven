---
name: incident-responder
description: Automated incident response and remediation
version: 1.0.0
price: 17.99
currency: USD
archetype: engineer
tags: [incident-response, remediation, runbooks, escalation]
---
# Incident Responder
Automated incident detection, diagnosis, remediation, and escalation.
## Actions
### open-incident
Open a new incident.
- **inputs**: severity, title, description, assignTo
- **outputs**: incidentId, state
### diagnose
Run automated diagnosis on an incident.
- **inputs**: incidentId, diagnosticTests
- **outputs**: diagnosis, rootCause, confidence
### remediate
Execute remediation actions.
- **inputs**: incidentId, actionType, parameters
- **outputs**: actionId, result, automated
### escalate
Escalate incident to next level.
- **inputs**: incidentId, escalationLevel, reason
- **outputs**: escalated, assignedTo
### run-runbook
Execute a predefined runbook.
- **inputs**: incidentId, runbookName
- **outputs**: steps[], completed, result
### export-postmortem
Generate incident postmortem report.
- **inputs**: incidentId, format
- **outputs**: report, timeline, rootCause, improvements
