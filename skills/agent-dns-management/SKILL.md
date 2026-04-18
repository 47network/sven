skill: agent-dns-management
name: Agent DNS Management
version: 1.0.0
description: >
  Autonomous DNS zone and record management for Sven's infrastructure.
  Creates zones, manages records, tracks propagation, and ensures DNS health.

triggers:
  - dns_create_zone
  - dns_add_record
  - dns_update_record
  - dns_delete_record
  - dns_check_propagation
  - dns_report

intents:
  - create and manage DNS zones
  - add, update, and delete DNS records
  - monitor DNS propagation status
  - perform DNS health checks
  - generate DNS configuration reports

outputs:
  - DNS zone configurations
  - DNS record changes with propagation tracking
  - DNS health check results
  - zone management reports
