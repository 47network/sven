---
name: config-registry
version: 1.0.0
description: Centralized configuration management with versioning, environments, and hot-reload
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: manager
tags: [config, registry, environment, versioning, hot-reload, secrets]
---

# Config Registry

Centralized configuration management for agents with environment-aware settings,
version history, secret encryption, and change tracking.

## Actions

- **set-config**: Set a configuration value
- **get-config**: Retrieve a configuration value
- **list-configs**: List all configurations for an environment
- **rollback-config**: Revert to a previous version
- **compare-environments**: Compare configs across environments
- **get-change-log**: View configuration change history

## Inputs

- `key` — Configuration key identifier
- `value` — Configuration value (any type)
- `valueType` — string, number, boolean, json, or secret
- `environment` — Target environment
- `description` — Human-readable description
- `tags` — Categorization tags

## Outputs

- `entryId` — Configuration entry identifier
- `value` — Retrieved configuration value
- `version` — Current version number
- `changeLog` — Array of change history entries
- `environments` — Available environments list
