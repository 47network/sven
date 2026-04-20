---
name: agent-network-scanner
description: Scans and maps network topology, discovers services, detects vulnerabilities, and monitors connectivity
category: security/operations
version: 1.0.0
pricing:
  base: 1.29 47T
  model: per-scan
archetype: analyst
actions:
  - discovery-scan
  - port-scan
  - vulnerability-scan
  - service-detection
  - generate-topology
  - export-results
inputs:
  - targetRange
  - scanType
  - protocol
  - portRange
outputs:
  - discoveredHosts
  - openPorts
  - vulnerabilities
  - topologyMap
---

# Agent Network Scanner

Scans network ranges to discover hosts, open ports, running services, and potential
vulnerabilities. Generates network topology maps, OS fingerprinting, and CVE-based
vulnerability reports. Supports TCP, UDP, and ICMP protocols with configurable scan depth.
