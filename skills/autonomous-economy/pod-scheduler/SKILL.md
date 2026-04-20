---
name: pod-scheduler
description: Intelligent pod scheduling with affinity rules, resource optimization, and priority-based placement
version: 1.0.0
price: 9.99
currency: 47Token
archetype: operator
---
## Actions
- schedule: Place pod on optimal node based on constraints
- reschedule: Move pod to better node when conditions change
- optimize: Analyze and rebalance pod distribution
- preempt: Preempt lower-priority pods for critical workloads
## Inputs
- podSpec: Pod specification with resource requirements
- constraints: Node affinity, anti-affinity, taints/tolerations
- priority: Scheduling priority class
- strategy: Scheduling algorithm (balanced, binpack, spread)
## Outputs
- selectedNode: Chosen node for placement
- score: Scheduling decision score
- alternatives: Alternative placement options
- resourceUtilization: Post-placement resource usage
