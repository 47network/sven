---
name: queue-manager
version: 1.0.0
description: Manages message queues for async agent communication with DLQ and rate limiting
author: sven-autonomous-economy
price: 0
currency: 47Token
archetype: manager
tags: [queue, messaging, async, dlq, rate-limit, fifo]
---

# Queue Manager

Manages message queues for asynchronous inter-agent communication. Supports FIFO,
priority, delay, and dead-letter queues with visibility timeouts and rate limiting.

## Actions

- **create-queue**: Create a new message queue
- **send-message**: Publish a message to a queue
- **receive-messages**: Poll for available messages
- **acknowledge-message**: Mark message as processed
- **dead-letter**: Move failed messages to DLQ
- **purge-queue**: Clear all messages from a queue

## Inputs

- `queueName` — Unique queue name within agent scope
- `queueType` — standard, fifo, priority, delay, or dead_letter
- `messageBody` — Message payload (JSON)
- `priority` — Message priority for priority queues
- `visibilityTimeout` — Seconds before message becomes visible again

## Outputs

- `queueId` — Created queue identifier
- `messageId` — Published message identifier
- `messages` — Array of received messages
- `currentSize` — Current queue depth
- `dlqCount` — Dead-letter queue message count
