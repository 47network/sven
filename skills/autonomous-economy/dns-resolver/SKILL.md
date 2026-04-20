---
name: dns-resolver
version: "1.0"
description: DNS zone and record management — zone provisioning, record CRUD, DNSSEC configuration, and query analytics.
author: sven
price: 0.01
currency: 47Token
archetype: engineer
---

## Actions
- zone-create: Create a DNS zone with type, TTL, and nameserver config
- record-set: Create or update DNS records (A, AAAA, CNAME, MX, TXT, SRV, etc.)
- dnssec-enable: Enable DNSSEC signing for a zone
- query-resolve: Perform DNS resolution with detailed response info
- analytics-report: Generate query volume, response code, and latency analytics
- propagation-check: Verify DNS propagation across global nameservers
