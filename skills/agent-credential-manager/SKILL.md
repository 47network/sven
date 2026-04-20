---
name: agent-credential-manager
version: 1.0.0
description: Secure credential lifecycle management — vault operations, key rotation, audit trails, leak detection
category: security
pricing:
  base: 3.49
  currency: USD
  per: credential_rotation_cycle
tags: [credentials, secrets, vault, rotation, security, compliance]
---

# Agent Credential Manager

Manages the full lifecycle of credentials: API keys, passwords, tokens, certificates, SSH keys, and OAuth tokens.

## Actions
- **create-store**: Initialize a credential store (vault, KMS, HSM)
- **add-credential**: Store new credential with encryption and rotation policy
- **rotate-credential**: Perform scheduled or emergency credential rotation
- **audit-credentials**: Generate audit trail reports with risk assessment
- **detect-leaks**: Scan for leaked or compromised credentials
- **revoke-credential**: Immediately revoke compromised credentials
