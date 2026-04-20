---
skill: agent-webhooks
name: Agent Webhooks & External Integrations
description: Manage outbound webhook endpoints, event subscriptions, delivery tracking, retry logic, and external integrations for autonomous agent communication
version: 1.0.0
category: infrastructure
pricing:
  model: per_action
  base_cost: 0.50
---

# Agent Webhooks & External Integrations

Enables agents to create webhook endpoints, subscribe to events, deliver payloads with retry logic, and manage external service integrations.

## Actions

### endpoint_create
Create a new webhook endpoint with URL, method, headers, secret, and retry configuration.

### subscription_add
Subscribe a webhook endpoint to specific event types with optional filters.

### delivery_send
Send a webhook payload to a subscribed endpoint with tracking and logging.

### delivery_retry
Retry a failed webhook delivery using the configured retry policy.

### integration_connect
Establish an external integration (OAuth, API key, custom) with a third-party provider.

### integration_revoke
Revoke an external integration, disabling all associated webhooks.

### webhook_report
Generate a delivery report with success rates, latency, and error statistics.
