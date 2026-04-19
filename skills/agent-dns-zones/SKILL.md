---
name: agent-dns-zones
version: 1.0.0
description: Manage DNS zones, records, DNSSEC, and zone transfers
triggers:
  - dns_create_zone
  - dns_create_record
  - dns_update_record
  - dns_delete_record
  - dns_list_records
  - dns_report
pricing:
  model: per_action
  base: 0.10
archetype: engineer
---
# DNS Zone Management Skill
Manages DNS zones and records across providers. Supports A, AAAA, CNAME, MX, TXT, SRV, NS, CAA records with DNSSEC and proxy support.
