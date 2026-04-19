---
name: agent-certificate-manager
description: Manages TLS/SSL certificates with auto-renewal, monitoring, and expiry alerting
version: "1.0"
category: security
archetype: operations
pricing:
  base: 0.99
  currency: 47T
actions:
  - import_certificate
  - request_renewal
  - monitor_expiry
  - verify_chain
  - revoke_certificate
  - audit_inventory
inputs:
  - certName
  - domain
  - certType
  - keyAlgorithm
  - autoRenew
  - renewDaysBefore
outputs:
  - inventory
  - renewals
  - monitors
  - chainValidation
  - auditReport
---
# Agent Certificate Manager

Manages TLS/SSL certificate lifecycle including inventory tracking, auto-renewal
via ACME (Let's Encrypt), CA-signed certificates, monitoring for expiry and
revocation, chain validation, and key strength auditing. Supports RSA, EC,
and Ed25519 key algorithms.
