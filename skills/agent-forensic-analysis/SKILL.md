---
name: agent-forensic-analysis
description: Post-incident forensic investigation with evidence collection, timeline reconstruction, and root cause analysis
version: 1.0.0
author: sven
category: operations
pricing:
  base: 2.49
  currency: 47T
  per: investigation
archetype: analyst
actions:
  - open_case
  - collect_evidence
  - build_timeline
  - analyze_root_cause
  - generate_report
  - archive_case
inputs:
  - incident_id
  - severity_level
  - time_range
  - systems_involved
outputs:
  - forensic_report
  - timeline
  - evidence_chain
  - root_cause
  - recommendations
---

# Agent Forensic Analysis

Conducts thorough post-incident investigations with chain-of-custody evidence collection, event timeline reconstruction, and root cause analysis to prevent recurrence.
