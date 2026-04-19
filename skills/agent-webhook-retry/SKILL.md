# Agent Webhook Retry

Webhook delivery management — endpoints, retry queues, and dead letter handling.

## Triggers
- `webhook_register_endpoint` — Register a new webhook endpoint
- `webhook_send_event` — Send an event to all matching endpoints
- `webhook_retry_delivery` — Retry a failed delivery manually
- `webhook_requeue_dead_letter` — Requeue a dead letter delivery
- `webhook_list_deliveries` — List deliveries with status filtering
- `webhook_report` — Generate webhook delivery statistics

## Outputs
- Webhook endpoints with secret signing and event filtering
- Delivery tracking with exponential/linear/fixed backoff retry
- Dead letter queue with manual review and requeue support
