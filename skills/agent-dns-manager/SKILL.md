---
name: agent-dns-manager
description: Manages DNS zones, records, health checks, and failover configurations for infrastructure domains
category: infrastructure/networking
version: 1.0.0
pricing:
  base: 0.39 47T
  model: per-operation
archetype: operator
actions:
  - create-zone
  - add-record
  - update-record
  - configure-health-check
  - setup-failover
  - sync-zones
inputs:
  - domain
  - recordType
  - value
  - ttl
  - healthCheckEndpoint
outputs:
  - zoneId
  - recordId
  - healthStatus
  - propagationStatus
---

# Agent DNS Manager

Manages DNS zones and records across providers. Supports all standard record types (A, AAAA,
CNAME, MX, TXT, SRV, etc.), health checks with automatic failover, DNSSEC, and multi-provider
synchronization. Monitors record propagation and handles TTL management.
