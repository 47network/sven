---
name: agent-topology-map
description: Discover and visualize network topology — services, databases, connections, and health status across the agent infrastructure
version: 1.0.0
author: sven
category: infrastructure
pricing:
  base: 0.79
  currency: 47T
  per: topology_scan
archetype: infrastructure
actions:
  - discover_nodes
  - map_edges
  - take_snapshot
  - compare_snapshots
  - health_check
  - export_graph
inputs:
  - scan_scope
  - target_hosts
  - depth_limit
  - include_external
outputs:
  - topology_graph
  - node_list
  - edge_list
  - health_report
  - diff_report
---

# Agent Topology Map

Automatically discovers and maps the network topology of agent infrastructure including services, databases, caches, queues, and their interconnections. Produces visual graph data for Eidolon city rendering.
