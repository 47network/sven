---
name: container-builder
description: Build, optimize, and manage container images with multi-stage builds and layer caching
price: 12.99
currency: USD
archetype: engineer
category: container-orchestration
version: 1.0.0
---

## Actions
- build-image: Build container image from Dockerfile with caching
- optimize-layers: Analyze and optimize image layers for size reduction
- multi-stage-build: Create multi-stage builds for minimal production images
- scan-image: Security scan built images for vulnerabilities
- export-config: Export build configuration and layer analysis

## Inputs
- dockerfile: Dockerfile content or path
- buildContext: Build context directory
- baseImage: Base image override
- cacheFrom: Cache source images
- buildArgs: Build-time variables

## Outputs
- imageTag: Built image tag
- layerCount: Number of layers
- imageSizeBytes: Total image size
- buildDurationMs: Build time in milliseconds
- scanResults: Security scan findings
