---
name: data-sync-engine
description: Synchronizes data between sources with incremental, full, and bidirectional sync modes
version: 1.0.0
pricing: 21.99
currency: USD
billing: per_connection
archetype: engineer
tags: [data-sync, etl, replication, migration, incremental, bidirectional]
---
# Data Sync Engine
Synchronizes data between heterogeneous sources with support for incremental, full, bidirectional, and mirror sync modes.
## Actions
### create-connection
Creates a sync connection between source and destination with field mappings.
### start-sync
Initiates a sync run on a configured connection with optional overrides.
### get-sync-status
Returns current sync status including records processed, created, updated, and failed.
### list-connections
Lists all sync connections with their status and last sync timestamps.
### configure-mapping
Updates field mappings and transformation rules for a sync connection.
### get-run-history
Retrieves sync run history with detailed statistics and error logs.
