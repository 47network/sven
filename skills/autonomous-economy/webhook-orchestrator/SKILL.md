---
name: webhook-orchestrator
description: Manages webhook endpoints, delivery, retries, and signature verification for event notifications
version: 1.0.0
pricing: 14.99
currency: USD
billing: per_endpoint
archetype: engineer
tags: [webhooks, events, notifications, delivery, signatures, retry]
---
# Webhook Orchestrator
Manages webhook endpoints with automatic delivery, retry policies, signature verification, and delivery tracking.
## Actions
### create-endpoint
Registers a new webhook endpoint with URL, events, secret, and custom headers.
### send-webhook
Dispatches a webhook payload to matching endpoints with signature signing.
### list-endpoints
Lists all registered webhook endpoints with delivery statistics.
### get-deliveries
Retrieves delivery history for an endpoint with status and response details.
### retry-failed
Retries all failed deliveries for a specific endpoint or delivery ID.
### update-endpoint
Updates endpoint configuration including URL, events, or active status.
