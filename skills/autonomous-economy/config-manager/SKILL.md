---
name: config-manager
description: Manage application configuration with encryption, versioning, and live reload
price: 9.99
currency: USD
archetype: engineer
category: container-orchestration
version: 1.0.0
---

## Actions
- set-config: Set a configuration value with encryption
- get-config: Retrieve and decrypt a configuration value
- list-configs: List all configuration entries for an environment
- rollback-config: Rollback configuration to a previous version
- export-config: Export full configuration snapshot

## Inputs
- keyPath: Configuration key path (dot-notation)
- value: Configuration value
- valueType: Value type (string/number/boolean/json/secret)
- environment: Target environment
- encryptionKey: Encryption key for secrets

## Outputs
- entryId: Configuration entry ID
- version: Current version number
- previousValue: Previous value (for rollback reference)
- configSnapshot: Full configuration snapshot
- changeHistory: Recent change history
