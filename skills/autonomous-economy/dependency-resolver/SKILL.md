---
name: dependency-resolver
version: 1.0.0
description: Resolves package dependencies with version constraints and conflict detection
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: analyst
tags: [dependencies, resolution, semver, packages, conflicts, graph]
---

# Dependency Resolver

Resolves package dependency graphs using configurable strategies (semver, exact,
latest, minimal) with automatic conflict detection and resolution suggestions.

## Actions

- **resolve-graph**: Build and resolve a dependency graph
- **check-conflicts**: Detect version conflicts in a graph
- **suggest-resolution**: Suggest conflict resolution strategies
- **list-graphs**: List saved dependency graphs
- **update-graph**: Re-resolve with updated constraints
- **export-lockfile**: Export resolved versions as lockfile

## Inputs

- `rootPackage` — Root package identifier
- `dependencies` — Map of package to version constraint
- `strategy` — semver, exact, latest, or minimal
- `allowPrerelease` — Include pre-release versions
- `registryUrl` — Package registry URL

## Outputs

- `graphId` — Resolved graph identifier
- `resolvedVersions` — Map of package to resolved version
- `conflicts` — Array of detected conflicts
- `suggestions` — Resolution suggestions for conflicts
- `nodeCount` — Total packages in graph
