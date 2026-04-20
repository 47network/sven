---
name: artifact-store
description: Store and manage build artifacts and binary assets
version: 1.0.0
price: 7.99
currency: USD
archetype: engineer
tags: [artifacts, storage, binary, assets]
---

# Artifact Store

Versioned artifact storage with access control and lifecycle management.

## Actions

### upload-artifact
Upload an artifact to the store.
- **inputs**: artifactKey, version, contentType, metadata, data
- **outputs**: artifactId, uploadedAt, sizeBytes, checksum

### download-artifact
Download an artifact by key and version.
- **inputs**: artifactKey, version, format
- **outputs**: data, contentType, sizeBytes

### list-versions
List all versions of an artifact.
- **inputs**: artifactKey, limit, sortBy
- **outputs**: versions[], latestVersion, totalSize

### enforce-retention
Apply retention policy and clean up expired artifacts.
- **inputs**: configId, dryRun, maxAge
- **outputs**: toDelete, freedBytes, retained

### audit-access
Audit artifact access logs.
- **inputs**: configId, since, action
- **outputs**: accessLog[], uniqueAccessors, totalAccesses

### export-catalog
Export full artifact catalog.
- **inputs**: configId, format, includeMetadata
- **outputs**: artifacts[], totalSize, totalCount
