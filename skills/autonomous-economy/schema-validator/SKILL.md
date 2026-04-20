---
name: schema-validator
version: 1.0.0
description: Validates data structures against schemas with versioning and compatibility checks
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: analyst
tags: [schema, validation, json-schema, avro, protobuf, compatibility]
---

# Schema Validator

Validates data structures against registered schemas with support for versioning,
compatibility checking, and multiple schema formats.

## Actions

- **register-schema**: Register a new schema definition
- **validate-data**: Validate data against a schema
- **check-compatibility**: Check schema version compatibility
- **list-schemas**: List registered schemas
- **get-schema**: Retrieve a specific schema version
- **deprecate-schema**: Mark a schema version as deprecated

## Inputs

- `schemaName` — Schema identifier name
- `version` — Schema version string
- `schemaType` — json_schema, avro, protobuf, openapi, graphql, or custom
- `definition` — Schema definition object
- `data` — Data to validate against schema
- `compatibility` — backward, forward, full, or none

## Outputs

- `schemaId` — Registered schema identifier
- `isValid` — Validation result boolean
- `errors` — Array of validation errors
- `warnings` — Array of validation warnings
- `compatible` — Compatibility check result
