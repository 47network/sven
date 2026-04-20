# Agent Storage Tiering

Storage lifecycle management — hot/warm/cold/archive tiers with automated data movement.

## Triggers
- `storage_create_tier` — Create a new storage tier
- `storage_create_lifecycle_rule` — Create a lifecycle rule for tier migration
- `storage_trigger_migration` — Manually trigger a storage migration
- `storage_get_usage` — Get storage usage across all tiers
- `storage_estimate_cost` — Estimate monthly storage costs
- `storage_report` — Generate storage tiering statistics

## Outputs
- Storage tiers with cost tracking and capacity limits
- Lifecycle rules with age and access frequency thresholds
- Migration jobs with progress tracking and error handling
