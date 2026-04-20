---
name: message-broker-admin
description: Administer message broker infrastructure. Monitor broker health, manage topics, track subscriber counts, and perform maintenance operations across NATS, RabbitMQ, Kafka, and Pulsar.
version: 1.0.0
author: sven
pricing: 0.03 per admin operation
archetype: engineer
tags: [broker, messaging, admin, monitoring, topics, infrastructure]
---

## Actions
- health-check: Run a comprehensive health check on the broker
- create-topic: Create a new topic with partition and retention configuration
- delete-topic: Archive and remove a topic
- list-topics: List all managed topics with subscriber counts
- monitor: Continuous health monitoring with alerting
- rebalance-partitions: Rebalance topic partitions across brokers

## Inputs
- brokerType: Type of message broker to administer
- topicName: Name of the topic to operate on
- partitionCount: Number of partitions for a topic
- retentionHours: Message retention period in hours
- connectionUrl: Broker connection URL

## Outputs
- healthStatus: Current broker health (healthy/degraded/unhealthy)
- latencyMs: Broker response latency
- messageRate: Current message throughput rate
- topics: List of managed topics
- alerts: Any active health alerts
