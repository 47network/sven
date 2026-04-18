---
skill: agent-schema-registry
name: Agent Schema Registry
version: 1.0.0
description: Centralized schema registry for agent data contracts with versioning and compatibility
author: sven-autonomous-economy
archetype: analyst
tags: [schemas, registry, versioning, compatibility, contracts]
price: 0
currency: 47Token
actions:
  - registry_register_schema
  - registry_publish_version
  - registry_add_dependency
  - registry_subscribe
  - registry_check_compatibility
  - registry_evolve
  - registry_report
---

# Agent Schema Registry

Centralized schema registry for agent data contracts with versioning,
compatibility checking, dependency tracking, and evolution logging.

## Actions

### registry_register_schema
Register a new schema in the registry.
- **Input**: namespace, name, schemaFormat, definition, compatibility
- **Output**: registryId, namespace, name, version, status

### registry_publish_version
Publish a new version of a registered schema.
- **Input**: registryId, version, definition, changelog, isBreaking
- **Output**: versionId, version, isBreaking, publishedAt

### registry_add_dependency
Add a dependency between schemas.
- **Input**: schemaId, dependsOn, dependencyType, versionConstraint
- **Output**: dependencyId, schemaId, dependsOn, dependencyType

### registry_subscribe
Subscribe a consumer to schema updates.
- **Input**: schemaId, consumerId, consumerType, version
- **Output**: subscriptionId, consumerId, subscribedVersion

### registry_check_compatibility
Check compatibility between schema versions.
- **Input**: schemaId, newDefinition, targetVersion
- **Output**: compatible, breakingChanges[], warnings[]

### registry_evolve
Log a schema evolution event.
- **Input**: schemaId, fromVersion, toVersion, evolutionType, changes
- **Output**: evolutionId, evolutionType, impact

### registry_report
Generate schema registry health report.
- **Input**: namespace, dateRange
- **Output**: totalSchemas, breakingChanges, consumers, recommendations
