---
name: event-sourcer
description: Implement event sourcing patterns. Manage event streams, aggregate snapshots, and projections across multiple store backends (PostgreSQL, EventStore, DynamoDB).
version: 1.0.0
author: sven
pricing: 0.05 per stream operation
archetype: engineer
tags: [event-sourcing, cqrs, streams, projections, aggregates]
---

## Actions
- create-stream: Create a new event stream for an aggregate
- append-event: Append an event to a stream
- read-stream: Read events from a stream
- create-snapshot: Create a snapshot of aggregate state
- create-projection: Create a new read-model projection
- rebuild-projection: Rebuild a projection from scratch
