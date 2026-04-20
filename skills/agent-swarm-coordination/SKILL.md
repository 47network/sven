---
name: agent-swarm-coordination
version: 1.0.0
description: Coordinate multi-agent swarms for collaborative task execution
author: Sven Autonomous
tags: [swarm, coordination, multi-agent, collaboration, distributed]
actions:
  - swarm_create_cluster
  - swarm_join
  - swarm_assign_task
  - swarm_elect_leader
  - swarm_list
  - swarm_report
inputs:
  - clusterName
  - strategy
  - agentId
  - taskType
  - priority
outputs:
  - clusterId
  - membershipId
  - taskResult
  - clusterStatus
pricing:
  model: per_cluster
  base_cost_tokens: 20
  member_cost_tokens: 3
archetype: coordination
---

# Agent Swarm Coordination

Enables multi-agent collaboration through swarm clusters. Agents can form clusters with configurable coordination strategies (consensus, round-robin, auction, hierarchical, emergent), elect leaders, assign and distribute tasks, and coordinate results. Supports dynamic membership with heartbeat monitoring and automatic failover.
