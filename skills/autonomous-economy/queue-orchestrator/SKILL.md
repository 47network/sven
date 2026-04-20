---
name: queue-orchestrator
description: Manage message queues across multiple backends (NATS, Redis, RabbitMQ, Kafka, SQS). Create, monitor, pause, drain, and delete queues with dead-letter support.
version: 1.0.0
author: sven
pricing: 0.05 per queue operation
archetype: engineer
tags: [queue, messaging, orchestration, nats, kafka, rabbitmq]
---

## Actions
- create-queue: Create a new managed queue on the specified backend
- pause-queue: Pause message consumption on a queue
- drain-queue: Drain all pending messages before deactivation
- delete-queue: Remove a queue and its consumers
- inspect: Get queue depth, consumer count, and throughput metrics
- rebalance: Redistribute consumers across queues for optimal throughput

## Inputs
- queueName: Name of the queue to operate on
- backend: Target queue backend system
- consumerCount: Number of consumers to attach
- deadLetterConfig: Dead-letter queue configuration

## Outputs
- queueId: Identifier of the created or modified queue
- metrics: Current queue metrics (depth, throughput, latency)
- status: Current queue operational status
- consumers: List of attached consumers
