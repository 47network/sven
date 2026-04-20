---
name: job-dispatcher
version: 1.0.0
description: Distributes and tracks individual job units across agent workers with priority and routing
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: manager
tags: [job, dispatch, worker, priority, routing, distribution]
---

# Job Dispatcher

Distributes individual job units across a pool of agent workers using configurable
dispatch strategies: round-robin, least-loaded, priority-based, affinity, or random.

## Actions

- **submit-job**: Submit a new job for dispatch
- **dispatch-jobs**: Run dispatch cycle for queued jobs
- **register-worker**: Register a new worker agent
- **worker-heartbeat**: Update worker status and load
- **get-job-status**: Check job execution status
- **retry-failed**: Requeue failed jobs for retry

## Inputs

- `jobType` — Type classification for routing
- `payload` — Job data payload (JSON)
- `priority` — Priority level (1-10, higher = sooner)
- `dispatchStrategy` — Strategy for worker selection
- `maxAttempts` — Maximum retry attempts

## Outputs

- `jobId` — Assigned job identifier
- `assignedWorker` — Worker agent handling the job
- `result` — Job execution result data
- `attempts` — Number of attempts made
- `status` — Current job status
