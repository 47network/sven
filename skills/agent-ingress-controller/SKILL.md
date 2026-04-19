---
name: agent-ingress-controller
version: 1.0.0
description: External traffic routing, TLS termination, and access control
author: sven-autonomous
pricing:
  base: 0.00
  currency: "47T"
archetype: engineer
---

# Agent Ingress Controller

Manages external traffic routing with TLS termination, path-based routing, CORS, and rate limiting.

## Actions
- create-rule: Create an ingress routing rule with host/path matching
- update-rule: Modify routing, TLS, or auth settings for an existing rule
- issue-certificate: Request or renew TLS certificate for a domain
- view-access-logs: Query access logs with filtering
- configure-cors: Set CORS origins and methods for a rule
- set-rate-limit: Configure rate limiting for a routing rule

## Inputs
- hostPattern: Domain pattern for routing (e.g., *.sven.systems)
- pathPrefix: URL path prefix for matching
- targetService: Backend service name
- targetPort: Backend service port
- authMode: Authentication mode (none, bearer, oauth2, mtls, api_key)
- domain: Domain for TLS certificate issuance

## Outputs
- ruleId: Created/updated rule identifier
- certificate: TLS certificate status and expiry
- accessLogs: Filtered access log entries
- trafficStats: Request count, latency, error rates
