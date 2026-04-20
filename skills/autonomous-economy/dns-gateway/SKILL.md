---
name: dns-gateway
description: DNS resolution, caching, and record management gateway
version: 1.0.0
price: 12.99
currency: USD
archetype: engineer
category: networking
tags: [dns, resolution, caching, records]
---

# DNS Gateway

Provides DNS resolution services with intelligent caching, DNSSEC support, and programmatic record management for agent infrastructure.

## Actions

### resolve-domain
Resolve a domain name with support for all record types (A, AAAA, CNAME, MX, TXT, SRV).

### manage-records
Create, update, or delete DNS records in managed zones.

### cache-warmup
Pre-populate DNS cache with frequently accessed domains for faster resolution.

### dnssec-validate
Validate DNSSEC signatures and chain of trust for secure DNS responses.

### query-analytics
Analyze DNS query patterns, cache hit rates, and resolution performance.

### upstream-health
Monitor upstream DNS server health and automatically failover to backup resolvers.
