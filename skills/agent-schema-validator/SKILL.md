---
name: agent-schema-validator
version: 1.0.0
description: Data schema validation, evolution tracking, and compatibility checking
archetype: analyst
pricing: 0.005 per validation
---

# Schema Validator

Validate data against schemas, track schema evolution, and check compatibility.

## Actions

### create-schema
Register a new schema definition (JSON Schema, Avro, Protobuf, OpenAPI, etc.)

### validate-data
Validate input data against a registered schema

### check-evolution
Check backward/forward compatibility between schema versions

### deprecate-schema
Mark a schema version as deprecated

### list-schemas
List all registered schemas with version history
