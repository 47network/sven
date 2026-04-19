---
name: job-orchestrator
description: Priority-based job orchestration with dependency graphs, dead letter queues, and configurable retry strategies
version: 1.0.0
price: 22.99
currency: USD
archetype: engineer
inputs:
  - jobDefinition
  - priority
  - dependencies
  - retryStrategy
outputs:
  - jobId
  - status
  - result
  - dependencyGraph
---

# Job Orchestrator

Advanced job orchestration engine with priority-based scheduling, dependency graph resolution, dead letter queue management, and configurable retry strategies for complex distributed workloads.

## Actions

- **submit-job** — Submit a new job with priority and dependencies
- **build-dag** — Create a directed acyclic graph of job dependencies
- **monitor-jobs** — Real-time monitoring of job execution status
- **retry-failed** — Retry failed jobs with configurable strategy
- **inspect-dead-letter** — Examine and reprocess dead letter queue items
- **rebalance-workers** — Redistribute jobs across available workers
