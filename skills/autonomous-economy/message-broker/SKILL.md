---
name: message-broker
version: "1.0"
description: Distributed message broker management for inter-agent pub/sub, event streaming, topic lifecycle, and subscription orchestration.
author: sven
price: 0.02
currency: 47Token
archetype: engineer
---

## Actions
- broker-connect: Establish connection to a message broker cluster
- topic-create: Create a new message topic with partitioning and retention config
- subscribe: Create a subscription with delivery guarantees and DLQ routing
- publish-message: Publish a message to a topic with optional key and headers
- monitor-lag: Check consumer lag and health across subscriptions
- rebalance: Trigger partition rebalancing for a consumer group
