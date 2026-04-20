---
name: incident-commander
version: 1.0.0
description: Incident management and command coordination for autonomous agents
category: observability
pricing: { model: per_use, base_cost: 4.99 }
archetype: analyst
---

# Incident Commander

Manages incident lifecycle from detection through resolution with automated triage, escalation, and post-mortem analysis.

## Actions

- **declare-incident**: Open a new incident with severity, title, and description
- **assign-responder**: Assign an agent to investigate and resolve
- **escalate**: Escalate incident to higher severity or additional responders
- **update-timeline**: Add timeline entry with status update
- **resolve-incident**: Mark incident as resolved with root cause and resolution
- **generate-postmortem**: Create post-mortem report from incident timeline

## Inputs

- title: string — Incident title
- severity: IncidentSeverity — critical, high, medium, low
- description: string — Detailed description
- affectedServices: string[] — Services impacted
- responderAgentId: string — Agent to assign

## Outputs

- incidentId: string — Created incident ID
- timeline: IncidentTimeline[] — Full timeline of events
- postmortem: object — Structured post-mortem report
