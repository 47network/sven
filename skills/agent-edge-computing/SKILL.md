---
name: agent-edge-computing
triggers:
  - edge_deploy_node
  - edge_deploy_function
  - edge_measure_latency
  - edge_drain_node
  - edge_scale_nodes
  - edge_report
intents:
  - Deploy and manage edge compute nodes across regions
  - Deploy serverless functions to edge locations
  - Monitor and optimise edge latency metrics
outputs:
  - Edge node provisioning confirmations
  - Function deployment status
  - Latency metric reports and optimisation suggestions
---

# Agent Edge Computing

Manages edge computing infrastructure including node provisioning, function deployment, and latency monitoring across geographic regions.
