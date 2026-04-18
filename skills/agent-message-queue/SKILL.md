---
skill: agent-message-queue
version: 1.0.0
triggers:
  - mq_create_queue
  - mq_register_consumer
  - mq_configure_dlq
  - mq_redrive_messages
  - mq_check_lag
  - mq_report
intents:
  - manage message queues and consumer groups
  - handle dead letter queues
  - monitor consumer lag
outputs:
  - queue creation confirmations
  - consumer registration results
  - DLQ redrive outcomes
  - queue depth and lag reports
---
# Agent Message Queue
Manages message queues with FIFO/priority/delay support, consumer group coordination, dead letter queue handling, and automated redrive policies.
