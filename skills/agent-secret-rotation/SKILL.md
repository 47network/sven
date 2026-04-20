---
name: agent-secret-rotation
version: 1.0.0
archetype: operations
price: 0.39 47T
status: active
---
# Agent Secret Rotation
Automated credential rotation with policy-based scheduling and expiry tracking.
## Actions
| Action | Description |
|--------|-------------|
| create-policy | Create a rotation policy for a secret pattern |
| rotate-now | Immediately rotate a specific secret |
| check-schedule | View upcoming rotation schedule |
| rotation-history | View rotation event history |
| rotation-health | Check rotation policy health and failures |
| pause-policy | Pause automatic rotation for a policy |
## Inputs
- `rotationType` — Rotation trigger (time_based, usage_based, event_based, manual)
- `intervalHours` — Rotation interval in hours (default 720)
- `secretPattern` — Pattern to match secrets for rotation
- `autoRotate` — Enable automatic rotation (default true)
## Outputs
- `policyId` — Created policy identifier
- `rotationEvent` — Rotation event details
- `schedule` — Upcoming rotation schedule
- `health` — Policy health status and failure count
