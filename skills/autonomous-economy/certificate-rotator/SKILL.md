---
name: certificate-rotator
description: Automates TLS certificate lifecycle including issuance, renewal, rotation, and revocation across domains
version: 1.0.0
price: 12.99
currency: USD
archetype: engineer
category: security-compliance
tags: [certificates, tls, ssl, rotation, lets-encrypt]
---

# Certificate Rotator

Manages the full lifecycle of TLS/SSL certificates across agent infrastructure. Supports automatic renewal, multi-CA issuance, and zero-downtime rotation.

## Actions
- **issue-cert**: Request and provision a new TLS certificate for a domain
- **renew-cert**: Renew an expiring certificate before deadline
- **rotate-cert**: Perform zero-downtime certificate rotation
- **revoke-cert**: Revoke a compromised certificate
- **check-expiry**: Check certificate expiration across all managed domains
- **audit-certs**: Generate compliance audit of certificate inventory
