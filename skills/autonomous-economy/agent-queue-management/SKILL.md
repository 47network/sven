---
skill: agent-queue-management
name: Agent Queue Management
version: 1.0.0
description: Create, manage, and monitor task queues for distributed agent workload processing with priority scheduling, dead-letter queues, and consumer orchestration
category: autonomous-economy
archetype: architect
pricing:
  model: per_action
  base_cost: 0
tags:
  - queue
  - messaging
  - scheduling
  - dead-letter
  - consumer
  - throughput
inputs:
  - name: queueConfig
    type: object
    description: Queue configuration including type, size limits, and retry policies
  - name: messageBody
    type: object
    description: Message payload to enqueue
  - name: scheduleConfig
    type: object
    description: Cron-based schedule configuration for recurring messages
outputs:
  - name: result
    type: object
    description: Queue operation result with status and metrics
---

# Agent Queue Management

Distributed task queue system for the autonomous agent ecosystem — FIFO, LIFO, priority, delayed, and dead-letter queues with consumer orchestration and performance metrics.

## Actions

### Create Queue
Create a new task queue with configurable type, size, and retry policies.
- **action**: `queue_create`
- **inputs**: name, description, queueType, maxSize, maxRetries, retryDelayMs, visibilityTimeoutMs
- **outputs**: queue object with id and configuration

### Enqueue Message
Add a message to a queue with optional priority and delay.
- **action**: `queue_enqueue`
- **inputs**: queueId, body, priority, delayUntil
- **outputs**: message object with id and status

### Dequeue Message
Retrieve and lock the next available message from a queue for processing.
- **action**: `queue_dequeue`
- **inputs**: queueId, consumerId, batchSize
- **outputs**: array of locked messages

### Complete Message
Mark a message as successfully processed with optional result data.
- **action**: `queue_complete`
- **inputs**: messageId, result
- **outputs**: updated message with completion timestamp

### Register Consumer
Register an agent as a consumer for a specific queue.
- **action**: `queue_register_consumer`
- **inputs**: queueId, agentId, batchSize, pollIntervalMs
- **outputs**: consumer registration with id and status

### Schedule Messages
Create a cron-based schedule for recurring message enqueuing.
- **action**: `queue_schedule`
- **inputs**: queueId, name, cronExpression, messageTemplate
- **outputs**: schedule object with next trigger time

### Queue Report
Generate queue performance metrics and health analytics.
- **action**: `queue_report`
- **inputs**: queueId, timeRange, includeConsumerStats
- **outputs**: throughput, latency percentiles, consumer utilization, DLQ stats
