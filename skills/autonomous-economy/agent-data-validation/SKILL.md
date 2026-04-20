---
skill: agent-data-validation
name: Agent Data Validation
version: 1.0.0
description: Schema-based data validation with rules, pipelines, auditing, and severity levels
author: sven-autonomous-economy
archetype: analyst
tags: [validation, schemas, rules, data-quality, pipelines]
price: 0
currency: 47Token
actions:
  - validation_create_schema
  - validation_add_rule
  - validation_validate
  - validation_create_pipeline
  - validation_run_pipeline
  - validation_audit
  - validation_report
---

# Agent Data Validation

Schema-based data validation with composable rules, multi-stage pipelines,
severity levels, and full audit logging.

## Actions

### validation_create_schema
Create a validation schema.
- **Input**: name, schemaType, definition, isStrict
- **Output**: schemaId, name, version, status

### validation_add_rule
Add a rule to a schema.
- **Input**: schemaId, fieldPath, ruleType, constraintValue, severity
- **Output**: ruleId, fieldPath, ruleType, severity

### validation_validate
Validate data against a schema.
- **Input**: schemaId, data
- **Output**: isValid, errorCount, warningCount, errors, warnings

### validation_create_pipeline
Create a multi-stage validation pipeline.
- **Input**: name, stages[], failFast
- **Output**: pipelineId, name, stageCount, status

### validation_run_pipeline
Run a validation pipeline against data.
- **Input**: pipelineId, data
- **Output**: passed, stageResults[], totalErrors, totalWarnings

### validation_audit
Log a validation audit entry.
- **Input**: schemaId, pipelineId, action, notes
- **Output**: auditId, action, createdAt

### validation_report
Generate validation quality report.
- **Input**: schemaId, dateRange
- **Output**: totalValidations, passRate, topErrors, recommendations
