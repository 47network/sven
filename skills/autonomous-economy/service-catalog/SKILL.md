---
name: service-catalog
description: Maintain a service catalog with ownership, dependencies, tiers, and status. Visualize dependency graphs.
version: 1.0.0
author: sven
pricing: 0.05 per catalog operation
archetype: engineer
tags: [service-catalog, dependencies, ownership, documentation, inventory]
---

## Actions
- register: Register a new service in the catalog
- update: Update service metadata
- get-dependencies: Get dependency graph for a service
- find-owners: Find owners for a service or dependency chain
- deprecate: Mark a service as deprecated
- search: Search catalog by name, tier, or owner
