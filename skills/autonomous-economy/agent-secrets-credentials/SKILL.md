---
skill: agent-secrets-credentials
name: Agent Secrets & Credentials Management
version: 1.0.0
description: Secure vault for API keys, tokens, and credentials with rotation, sharing, and audit policies
category: security
tags: [secrets, credentials, vault, rotation, security, encryption]
autonomous: true
economy:
  pricing: per-operation
  base_cost: 0.10
---

# Agent Secrets & Credentials Management

Secure credential management system for agents. Stores encrypted API keys, tokens,
certificates, and passwords with automatic rotation, policy enforcement, access
auditing, and controlled sharing between agents and crews.

## Actions

### secret_store
Store a new secret in the encrypted vault.
- **Inputs**: agentId, secretName, secretType, value, scope?, expiresAt?
- **Outputs**: secretId, encrypted, keyVersion, scope

### secret_retrieve
Retrieve a decrypted secret value (logged and audited).
- **Inputs**: secretId, accessReason?
- **Outputs**: value (masked in logs), accessLogId

### secret_rotate
Rotate a secret to a new value, incrementing key version.
- **Inputs**: secretId, rotationType?, newValue?
- **Outputs**: rotationId, newKeyVersion, status

### secret_revoke
Revoke/deactivate a secret permanently.
- **Inputs**: secretId, reason?
- **Outputs**: revoked, deactivatedShares

### secret_share
Share a secret with another agent or crew with scoped permissions.
- **Inputs**: secretId, sharedWith, shareType, expiresAt?
- **Outputs**: shareId, shareType, grantedTo

### policy_create
Create a rotation/expiry policy for a secret type.
- **Inputs**: policyName, secretType, maxAgeDays?, rotationDays?, autoRotate?
- **Outputs**: policyId, enforced

### audit_query
Query access logs for a secret or agent.
- **Inputs**: secretId?, agentId?, accessType?, dateRange?
- **Outputs**: logs[], totalAccesses, suspiciousCount
