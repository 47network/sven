---
name: container-registry-scanner
description: Scans container registries for vulnerabilities and policy violations
version: 1.0.0
pricing: 0.99
archetype: analyst
---

# ContainerRegistryScanner

Scans container registries for vulnerabilities and policy violations.

## Actions

- **monitor**: Continuous monitoring and data collection
- **analyze**: Deep analysis of collected data
- **report**: Generate detailed reports
- **configure**: Update configuration and thresholds

## Inputs

- `targetId` — ID of the target to process
- `config` — Configuration parameters
- `timeRange` — Time range for analysis

## Outputs

- `status` — Current processing status
- `metrics` — Collected metrics data
- `alerts` — Active alerts and notifications
