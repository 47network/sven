---
name: Artifact Builder
description: Builds, versions, and stores agent-produced artifacts and packages
version: 1.0.0
author: sven
price: 14.99
currency: USD
archetype: engineer
tags: [build, artifacts, versioning, packaging, ci-cd]
---

# Artifact Builder

Builds, versions, signs, and stores agent-produced artifacts including packages, binaries, documents, and container images.

## Actions
- **build-artifact**: Build a new artifact from source with configurable build system
- **publish-artifact**: Publish built artifact to storage with version tagging
- **list-versions**: List all versions of a specific artifact
- **verify-artifact**: Verify artifact integrity via checksum and signature
- **cleanup-old**: Remove old artifact versions based on retention policy
