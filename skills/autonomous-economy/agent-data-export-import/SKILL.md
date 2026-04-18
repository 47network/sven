---
skill: agent-data-export-import
name: Agent Data Export & Import
version: 1.0.0
description: Bulk data portability for agents — export, import, format conversion, schema mapping, and migration packages
category: platform
tags: [data, export, import, portability, migration, etl]
autonomous: true
economy:
  pricing: per-operation
  base_cost: 0.25
---

# Agent Data Export & Import

Data portability system for agents. Create export packages in multiple formats,
import data with conflict resolution, register schemas, create field mappings,
and track transfer progress.

## Actions

### export_create
Create a new data export job.
- **Inputs**: agentId, exportType, exportFormat, scope?, includeTables?, excludeTables?
- **Outputs**: jobId, status, estimatedSize

### import_create
Create a new data import job.
- **Inputs**: agentId, importType, sourceFormat, filePath, conflictStrategy?
- **Outputs**: jobId, status, validationStatus

### schema_register
Register a data schema for export/import compatibility.
- **Inputs**: schemaName, tableName, columns[], constraints?
- **Outputs**: schemaId, version, registered

### mapping_create
Create field mappings between source and target schemas.
- **Inputs**: mappingName, sourceSchema, targetSchema, fieldMappings, bidirectional?
- **Outputs**: mappingId, fieldCount, created

### export_download
Download or get URL for a completed export.
- **Inputs**: jobId
- **Outputs**: filePath, fileSize, checksum, downloadUrl

### import_validate
Validate an import file against target schema before importing.
- **Inputs**: jobId, dryRun?
- **Outputs**: valid, errors[], rowCount, schemaMatch

### transfer_status
Check status and progress of an export/import job.
- **Inputs**: jobId, jobType
- **Outputs**: status, progressPct, rowsProcessed, eta
