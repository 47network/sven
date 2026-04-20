---
name: incident-tracker
description: End-to-end incident management with severity tracking, escalation policies, and resolution workflows
version: 1.0.0
price: 7.99
currency: 47Token
archetype: analyst
---

## Actions
- create-incident: Register a new incident with severity classification
- escalate: Trigger escalation based on SLA breach or severity upgrade
- assign: Auto-assign or manually assign responders to incidents
- resolve: Mark incident resolved with root cause and resolution notes
- timeline: Generate incident timeline with all events and actions

## Inputs
- title: Incident title/summary
- severity: critical | high | medium | low
- description: Detailed incident description
- affectedServices: List of impacted services
- escalationPolicy: Custom escalation rules

## Outputs
- incidentId: Unique incident identifier
- status: Current incident status
- timeline: Ordered list of incident events
- resolution: Root cause and fix description
- metrics: MTTR, MTTA, escalation count
