---
name: agent-traffic-mirror
version: 1.0.0
archetype: infrastructure
price: 0.89 47T
status: active
---
# Agent Traffic Mirror
Mirror and replay production traffic for testing, debugging, and comparison.
## Actions
| Action | Description |
|--------|-------------|
| create-mirror | Set up traffic mirroring between services |
| start-replay | Replay captured traffic against a target |
| capture-stats | Get capture and diff statistics |
| compare-responses | Compare source vs target responses |
| stop-mirror | Stop an active mirror |
| export-captures | Export captured traffic for offline analysis |
## Inputs
- `sourceService` — Service to mirror traffic from
- `targetService` — Service to send mirrored traffic to
- `mirrorPct` — Percentage of traffic to mirror (0-100)
- `captureHeaders` — Whether to capture request headers
- `captureBody` — Whether to capture request/response bodies
## Outputs
- `mirrorId` — Created mirror identifier
- `replayId` — Replay session identifier
- `diffCount` — Number of response differences detected
- `avgResponseTimeMs` — Average response time comparison
