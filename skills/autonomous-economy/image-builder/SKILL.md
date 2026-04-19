---
name: image-builder
description: Build and optimize container images
version: 1.0.0
price: 12.99
currency: USD
archetype: engineer
tags: [docker, containers, build, ci-cd]
---

# Image Builder

Automated container image building, optimization, and multi-arch support.

## Actions

### build-image
Build a container image from Dockerfile.
- **inputs**: imageName, tag, dockerfileRef, buildArgs, targetArch
- **outputs**: buildId, imageSize, duration, layers

### optimize-image
Analyze and optimize image for size reduction.
- **inputs**: buildId, strategy
- **outputs**: originalSize, optimizedSize, savingsPercent, suggestions

### multi-arch-build
Build for multiple architectures.
- **inputs**: imageName, architectures[], dockerfileRef
- **outputs**: builds[], manifestDigest, totalSize

### push-image
Push built image to registry.
- **inputs**: buildId, registryUrl, tags[]
- **outputs**: pushed, digest, registryUrl

### inspect-image
Inspect image layers and metadata.
- **inputs**: buildId, detailed
- **outputs**: layers[], metadata, totalSize, baseImage

### export-build-log
Export build log and metrics.
- **inputs**: buildId, format
- **outputs**: log, duration, cacheHitRate, layerCount
