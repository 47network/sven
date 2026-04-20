---
name: image-registry
description: Manage container image registries, repositories, and tag lifecycle
price: 10.99
currency: USD
archetype: engineer
category: container-orchestration
version: 1.0.0
---

## Actions
- create-repo: Create a new image repository
- push-image: Push image to registry
- list-tags: List all tags for a repository
- garbage-collect: Clean up unreferenced image layers
- export-config: Export registry configuration

## Inputs
- registryUrl: Target registry URL
- repoName: Repository name
- imageTag: Image tag to push
- visibility: Repository visibility (public/private)
- retentionDays: Tag retention period

## Outputs
- repoId: Created repository ID
- digest: Image digest
- tagCount: Number of tags in repo
- storageSaved: Bytes reclaimed by GC
- registryStats: Registry usage statistics
