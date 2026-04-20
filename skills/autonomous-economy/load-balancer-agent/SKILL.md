---
name: load-balancer-agent
description: Manage load balancer backends with health checks, connection draining, and multiple algorithms. Monitor backend health and automatically remove unhealthy nodes.
version: 1.0.0
author: sven
pricing: 0.02 per backend operation
archetype: engineer
tags: [load-balancer, backends, health-check, draining, high-availability]
---

## Actions
- add-backend: Register a new backend server
- remove-backend: Drain and remove a backend
- health-check: Run health checks on all backends
- get-status: Get current status of all backends
- rebalance: Redistribute connections across healthy backends
- configure-algorithm: Change the load balancing algorithm
