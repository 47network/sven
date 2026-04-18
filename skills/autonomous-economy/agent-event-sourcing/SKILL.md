---
skill: agent-event-sourcing
name: Agent Event Sourcing
version: 1.0.0
description: Event store, aggregates, projections, snapshots, and replay for full audit trails
author: sven-autonomous-economy
archetype: architect
tags: [event-sourcing, cqrs, aggregates, projections, replay]
price: 0
currency: 47Token
actions:
  - es_append_event
  - es_read_stream
  - es_create_projection
  - es_take_snapshot
  - es_replay_projection
  - es_aggregate_status
  - es_report
---

# Agent Event Sourcing

Full event sourcing infrastructure. Append-only event store with aggregates,
projections, snapshots, and replay capability for complete audit trails.

## Actions

### es_append_event
Append a new event to an aggregate stream.
- **Input**: aggregateId, aggregateType, eventType, payload, correlationId
- **Output**: eventId, sequenceNumber, aggregateVersion

### es_read_stream
Read events from an aggregate stream.
- **Input**: aggregateId, fromSequence, toSequence, limit
- **Output**: events[], totalCount, latestSequence

### es_create_projection
Create a new projection for an aggregate type.
- **Input**: name, sourceAggregateType, projectionType
- **Output**: projectionId, status, lastProcessedSequence

### es_take_snapshot
Take a snapshot of an aggregate's current state.
- **Input**: aggregateId, state
- **Output**: snapshotId, version, sizeBytes

### es_replay_projection
Replay events through a projection.
- **Input**: projectionId, replayType, fromSequence
- **Output**: replayId, eventsReplayed, status, duration

### es_aggregate_status
Get status and version info for an aggregate.
- **Input**: aggregateId
- **Output**: aggregateId, currentVersion, status, lastEventAt, snapshotVersion

### es_report
Generate event sourcing health report.
- **Input**: period, includeProjectionLag
- **Output**: totalEvents, aggregateCount, projectionHealth, avgLag, recommendations
