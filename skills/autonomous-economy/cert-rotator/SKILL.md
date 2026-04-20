---
name: cert-rotator
version: 1.0.0
description: Automated TLS/SSL certificate lifecycle management, renewal, and rotation
author: sven
price: 4.99
currency: USD
archetype: engineer
tags: [security, certificates, tls, ssl, automation, infrastructure]
---

# Certificate Rotator

Manages the full lifecycle of TLS/SSL certificates — discovery, monitoring, renewal,
rotation, and revocation. Supports Let's Encrypt, ZeroSSL, and custom CAs.

## Actions

### check-expiry
Scan all managed certificates and report expiration status.

### renew-certificate
Trigger renewal for a specific certificate or all expiring ones.

### rotate-certificate
Replace an active certificate with a newly issued one, updating all dependent services.

### revoke-certificate
Revoke a compromised or decommissioned certificate.

### generate-csr
Generate a Certificate Signing Request for a new domain.

### audit-certificates
Produce a compliance report of all certificate statuses and configurations.
