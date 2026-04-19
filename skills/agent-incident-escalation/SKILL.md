---
name: agent-incident-escalation
version: 1.0.0
description: Manage incident response workflows, escalation chains, and post-mortems
triggers:
  - incident_create_policy
  - incident_open
  - incident_acknowledge
  - incident_escalate
  - incident_resolve
  - incident_report
pricing:
  model: per_incident
  base: 0.25
archetype: analyst
---
# Incident Escalation Skill
Manages incident response lifecycle — open, acknowledge, investigate, mitigate, resolve. Auto-escalation based on severity and time.
