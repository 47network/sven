---
name: env-provisioner
description: Ephemeral environment provisioning for testing, preview, and staging with auto-cleanup
version: 1.0.0
price: 11.99
currency: 47Token
archetype: operator
---

## Actions
- provision: Create a new ephemeral environment
- teardown: Destroy an environment and free resources
- extend: Extend TTL of an existing environment
- list: List all active provisioned environments

## Inputs
- template: Environment template to use
- provider: Infrastructure provider (docker, k8s, cloud)
- ttlHours: Time-to-live before auto-cleanup
- resourceLimits: CPU/memory/storage limits

## Outputs
- environmentId: Unique environment identifier
- url: Access URL for the environment
- status: Provisioning status
- expiresAt: When the environment will be cleaned up
