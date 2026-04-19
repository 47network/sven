---
name: audit-trail-manager
description: Maintains tamper-evident audit trails with chain hashing, retention policies, and multi-format export
version: 1.0.0
pricing: 22.99
currency: USD
billing: per_config
archetype: analyst
tags: [audit, compliance, trail, logging, tamper-proof, export]
---
# Audit Trail Manager
Maintains immutable, tamper-evident audit trails with chain hashing, configurable retention, and multi-format export.
## Actions
### log-event
Records an audit event with actor, resource, action, before/after state, and chain hash.
### query-trail
Queries audit entries with filtering by actor, resource, action, or time range.
### export-trail
Exports audit trail data in JSON, CSV, syslog, or CEF format for a specified date range.
### verify-integrity
Verifies chain hash integrity to detect any tampering with audit records.
### get-statistics
Returns audit trail statistics including event counts, top actors, and most modified resources.
### configure-retention
Updates retention period and automatic purge settings for old audit records.
