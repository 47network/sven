---
name: agent-certificate-manager
version: 1.0.0
description: TLS/SSL certificate lifecycle management — CA operations, issuance, renewal, revocation
category: security
pricing:
  base: 4.99
  currency: USD
  per: certificate_operation
tags: [certificates, tls, ssl, pki, acme, renewal]
---

# Agent Certificate Manager

Manages certificate authorities, certificate issuance, auto-renewal, and revocation across infrastructure.

## Actions
- **create-ca**: Initialize certificate authority (root, intermediate, ACME)
- **issue-certificate**: Issue server, client, wildcard, or code-signing certificates
- **renew-certificate**: Auto or manual certificate renewal before expiry
- **revoke-certificate**: Revoke compromised certificates with CRL update
- **monitor-expiry**: Track certificate expiration across all services
- **verify-chain**: Validate certificate chain integrity
