---
name: secret-manager
description: Securely stores, retrieves, and rotates secrets including API keys, passwords, certificates, and tokens
version: 1.0.0
pricing: 19.99
currency: USD
billing: per_config
archetype: engineer
tags: [secrets, vault, encryption, rotation, api-keys, credentials]
---
# Secret Manager
Securely manages secrets with encryption at rest, automatic rotation, version tracking, and access audit logging.
## Actions
### store-secret
Stores a new secret with encryption, type classification, and optional expiration.
### retrieve-secret
Retrieves a secret value with access logging and optional version selection.
### rotate-secret
Rotates a secret to a new version while keeping previous versions for rollback.
### list-secrets
Lists stored secrets (names/metadata only, no values) with type filtering.
### delete-secret
Marks a secret as deleted with configurable purge delay for recovery.
### get-access-log
Retrieves access audit log for a specific secret showing who accessed it and when.
