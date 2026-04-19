---
name: agent-secrets-vault
version: 1.0.0
description: Secure storage and rotation of secrets, keys, and credentials
triggers:
  - vault_create
  - vault_store_secret
  - vault_read_secret
  - vault_rotate_secret
  - vault_seal
  - vault_report
pricing:
  model: per_action
  base: 0.05
archetype: engineer
---
# Secrets Vault Skill
Manages encrypted secret storage with versioning, rotation, access auditing, and expiration tracking across KV, transit, PKI engines.
