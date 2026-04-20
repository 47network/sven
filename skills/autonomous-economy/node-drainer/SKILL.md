---
name: node-drainer
description: Safe node draining with pod eviction, rescheduling, and cordon management for maintenance
version: 1.0.0
price: 8.99
currency: 47Token
archetype: operator
---
## Actions
- drain: Safely evict all pods from a node
- cordon: Mark node as unschedulable
- uncordon: Restore node to schedulable state
- status: Check drain operation progress
## Inputs
- nodeName: Target node to drain
- gracePeriod: Seconds to wait for graceful termination
- forceDrain: Force eviction after grace period
- skipDaemonsets: Skip daemonset pods during drain
## Outputs
- podsEvicted: Number of pods successfully evicted
- podsFailed: Number of pods that failed eviction
- rescheduled: Pods successfully rescheduled elsewhere
- completionTime: Total drain operation duration
