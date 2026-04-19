---
name: event-reactor
description: Subscribes to events and triggers automated reactions with filtering, deduplication, and dead-letter handling
version: 1.0.0
pricing: 8.99
currency: USD
billing: per_subscription
archetype: engineer
tags: [events, reactive, subscriptions, triggers, event-driven, streaming]
---
# Event Reactor
Subscribes to event streams and triggers automated reactions with filtering, deduplication, and error handling.
## Actions
### create-subscription
Creates a new event subscription with pattern matching and filter configuration.
### process-event
Processes an incoming event against matching subscriptions and triggers reactions.
### list-subscriptions
Lists all active subscriptions with invocation counts and status.
### replay-events
Replays historical events through subscriptions for catch-up processing.
### get-dead-letters
Retrieves failed reactions from the dead-letter queue for inspection and retry.
### update-filters
Updates filter expressions on an existing subscription without recreating it.
