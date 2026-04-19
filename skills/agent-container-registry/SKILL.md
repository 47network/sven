---
name: agent-container-registry
version: 1.0.0
description: Manage private container image registries, push/pull images, scan for vulnerabilities
triggers:
  - registry_create
  - registry_push_image
  - registry_pull_image
  - registry_scan_vulns
  - registry_list_images
  - registry_report
pricing:
  model: per_action
  base: 0.50
archetype: engineer
---
# Container Registry Skill
Manages private container image registries for agent workloads. Push, pull, tag, and scan images for vulnerabilities.
