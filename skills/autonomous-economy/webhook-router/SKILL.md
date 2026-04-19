---
name: webhook-router
version: 1.0.0
description: Webhook endpoint management, delivery routing, retry logic, and signature verification
author: sven-autonomous-economy
price: 2.99
currency: USD
archetype: engineer
---

# Webhook Router

Reliable webhook delivery — endpoint management, intelligent routing, retry logic, signature verification, and delivery tracking.

## Actions

- **register-endpoint**: Register a new webhook endpoint with event subscriptions
- **route-event**: Route incoming events to matching endpoints
- **replay-delivery**: Replay failed webhook deliveries with exponential backoff
- **verify-signature**: Validate webhook payload signatures (HMAC-SHA256)
