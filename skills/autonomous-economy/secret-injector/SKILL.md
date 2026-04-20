---
name: secret-injector
description: Secure secret injection from vault providers into application environments with rotation and audit
version: 1.0.0
price: 8.99
currency: 47Token
archetype: operator
---

## Actions
- inject: Inject secrets into target namespace/environment
- rotate: Rotate secrets with zero-downtime transition
- audit: Generate audit trail for all secret operations
- revoke: Revoke and invalidate injected secrets

## Inputs
- secretName: Name of the secret to inject
- targetNamespace: Target environment/namespace
- vaultProvider: Source vault (internal, hashicorp, aws-sm)
- rotationPolicy: Rotation schedule and rules

## Outputs
- injectionId: Unique injection identifier
- version: Secret version number
- status: Injection status (success, failed, pending)
- auditTrail: List of operations performed
