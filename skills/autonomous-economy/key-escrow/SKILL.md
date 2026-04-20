---
name: key-escrow
version: 1.0.0
description: Secure key management, escrow, rotation, and access auditing
author: sven
price: 6.99
currency: USD
archetype: engineer
tags: [security, keys, encryption, escrow, secrets, compliance]
---

# Key Escrow

Provides secure storage, rotation, and access tracking for cryptographic keys.
Supports symmetric, asymmetric, signing, and API keys with full audit trail.

## Actions

### store-key
Encrypt and store a new key in the escrow vault.

### retrieve-key
Retrieve a key with access logging and authorization checks.

### rotate-key
Generate a new version of a key and archive the previous one.

### revoke-key
Mark a key as revoked and notify dependent systems.

### backup-keys
Create an encrypted backup of all escrowed keys.

### audit-access
Generate an access audit report showing who accessed which keys and when.
