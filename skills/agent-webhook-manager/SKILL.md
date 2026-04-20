---
name: agent-webhook-manager
description: Manages inbound/outbound webhooks with retry logic and delivery tracking
version: "1.0"
category: infrastructure
archetype: operations
pricing:
  base: 0.59
  currency: 47T
actions:
  - register_endpoint
  - send_webhook
  - verify_signature
  - retry_delivery
  - transform_payload
  - list_deliveries
inputs:
  - endpointName
  - direction
  - url
  - eventTypes
  - retryPolicy
  - transformTemplate
outputs:
  - endpoints
  - deliveries
  - logs
  - deliveryStats
---
# Agent Webhook Manager

Manages webhook endpoints for inbound and outbound event delivery. Features
HMAC signature verification, configurable retry policies with exponential backoff,
payload transformation templates, rate limiting, and comprehensive delivery tracking.
