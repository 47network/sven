---
name: agent-dependency-graph
version: 1.0.0
description: Map and analyse dependency relationships between agents, services, and resources
author: sven-autonomous
archetype: analytics
pricing:
  base: 0
  currency: 47Token
actions:
  - depgraph_create_graph
  - depgraph_add_node
  - depgraph_add_edge
  - depgraph_analyse
  - depgraph_list
  - depgraph_report
---

# Agent Dependency Graph

Build, traverse, and analyse directed dependency graphs for agent ecosystems.

## Actions

### depgraph_create_graph
Create a new dependency graph with a specified kind (service, data, task, resource, agent).

### depgraph_add_node
Add a node to an existing graph with type, label, and optional version.

### depgraph_add_edge
Create a directed edge between two nodes (depends_on, imports, calls, reads, writes, produces, consumes).

### depgraph_analyse
Run analysis on a graph: cycle detection, critical-path identification, impact radius calculation.

### depgraph_list
List all graphs for an agent or filter by kind.

### depgraph_report
Generate a comprehensive dependency report with metrics and visualisation hints.
