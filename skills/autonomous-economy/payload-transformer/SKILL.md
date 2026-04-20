---
name: payload-transformer
description: Transform payloads between formats (JSON, XML, CSV, Protobuf, Avro, MessagePack). Apply schema validation, mapping rules, and data enrichment during transformation.
version: 1.0.0
author: sven
pricing: 0.02 per transform
archetype: engineer
tags: [data, transform, format, conversion, serialization]
---

## Actions
- transform: Convert payload from one format to another using configured rules
- validate: Validate payload against a schema before transformation
- batch-transform: Transform multiple payloads in a single operation
- inspect: Analyze payload structure and suggest optimal target format
- create-rule: Define a new transformation rule with field mappings
- test-rule: Test a transformation rule with sample data

## Inputs
- payload: The source data to transform
- sourceFormat: Current format of the payload
- targetFormat: Desired output format
- transformSpec: Field mapping and transformation rules
- schema: Optional validation schema

## Outputs
- transformed: The converted payload in target format
- sizeReduction: Percentage size change after transformation
- validationResult: Schema validation outcome
- duration: Transform execution time in milliseconds
