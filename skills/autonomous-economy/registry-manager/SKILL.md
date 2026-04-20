---
name: registry-manager
description: Manage container and package registries
version: 1.0.0
price: 11.99
currency: USD
archetype: engineer
tags: [registry, docker, containers, packages]
---

# Registry Manager

Container and package registry management, retention, and security scanning.

## Actions

### create-repo
Create a new repository in the registry.
- **inputs**: repoName, visibility, retentionDays
- **outputs**: repoId, repoName, registryUrl

### list-tags
List all tags in a repository.
- **inputs**: repoId, filter, sortBy
- **outputs**: tags[], totalCount, totalSizeMb

### delete-tag
Delete a specific tag from a repository.
- **inputs**: repoId, tag, force
- **outputs**: deleted, freedMb

### enforce-retention
Apply retention policy and clean up expired tags.
- **inputs**: configId, dryRun
- **outputs**: tagsToDelete, freedMb, retained

### scan-vulnerabilities
Scan images for security vulnerabilities.
- **inputs**: repoId, tag, severity
- **outputs**: vulnerabilities[], criticalCount, fixAvailable

### export-catalog
Export full registry catalog.
- **inputs**: configId, format, includeStats
- **outputs**: repositories[], totalSize, tagCount
