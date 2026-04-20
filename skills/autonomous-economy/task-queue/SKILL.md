---
name: task-queue
version: 1.0.0
description: Priority-based task queuing with automated agent assignment, scheduling, and dependency tracking
category: autonomous-economy
tags: [queue, scheduling, priority, assignment, automation]
author: sven
license: proprietary
actions:
  - queue_submit
  - queue_poll
  - queue_assign
  - schedule_create
  - schedule_toggle
  - dependency_add
  - execution_history
pricing:
  queue_submit: 0.00
  queue_poll: 0.00
  queue_assign: 0.00
  schedule_create: 0.00
  schedule_toggle: 0.00
  dependency_add: 0.00
  execution_history: 0.00
---

# Task Queue & Scheduling

Centralized task queue for the autonomous economy. Agents submit tasks,
the scheduler assigns them based on skills/reputation/availability, and
the system tracks execution through completion.

## Task Lifecycle

```
submit → queued → assigned → in_progress → completed
                                         → failed → retried
                          → rejected → re-queued
           → deferred (scheduled for later)
           → expired (past deadline)
           → cancelled (manually stopped)
```

## Assignment Strategies

| Strategy | Description |
|----------|-------------|
| best_fit | Match required skills + reputation + availability score |
| round_robin | Rotate assignments evenly across eligible agents |
| least_loaded | Assign to agent with fewest active tasks |
| reputation_weighted | Prefer highest-reputation agents |
| random | Random selection from eligible pool |
| manual | Admin manually assigns agent |

## Priority Levels

| Label | Value | Use Case |
|-------|-------|----------|
| critical | 100 | System health, revenue-impacting |
| high | 75 | Customer-facing, time-sensitive |
| normal | 50 | Standard business tasks |
| low | 25 | Non-urgent improvements |
| background | 10 | Maintenance, cleanup |

## Dependencies

Tasks can depend on other tasks:
- **blocks**: Dependent task cannot start until blocker completes
- **suggests**: Soft dependency, advisory only
- **triggers**: Completing a task auto-queues the dependent

## Actions

### queue_submit
Submit a new task to the queue.
- **Input**: taskType, priority, payload, requiredSkills[], deadline
- **Output**: queueItemId, position, estimatedStartTime

### queue_poll
Poll for next available task matching agent skills.
- **Input**: agentId, skills[], maxCount
- **Output**: items[], totalQueued

### queue_assign
Assign a queued task to a specific agent.
- **Input**: queueItemId, agentId, strategy
- **Output**: assignmentId, score, reason

### schedule_create
Create a recurring task schedule.
- **Input**: name, taskType, cronExpression, payloadTemplate, priority
- **Output**: scheduleId, nextRunAt

### schedule_toggle
Enable or disable a schedule.
- **Input**: scheduleId, enabled
- **Output**: schedule, previousState

### dependency_add
Add a dependency between two tasks.
- **Input**: taskId, dependsOnId, depType
- **Output**: dependencyId, blockedCount

### execution_history
Get execution log for a task or agent.
- **Input**: queueItemId or agentId, limit, offset
- **Output**: logs[], totalCount
