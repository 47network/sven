---
skill: agent-container-registry
version: 1.0.0
triggers:
  - container_push_image
  - container_scan_image
  - container_set_retention
  - container_pull_stats
  - container_clean_images
  - container_report
intents:
  - manage container images and repositories
  - scan images for vulnerabilities
  - enforce retention and cleanup policies
outputs:
  - image push/pull confirmations
  - vulnerability scan reports
  - retention cleanup summaries
  - registry usage statistics
---
# Agent Container Registry
Manages container image lifecycle including pushing, pulling, vulnerability scanning with Trivy/Clair, and automated retention cleanup policies per repository.
