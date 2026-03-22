# Migration Rollback Plan (Parity Phases)

This plan covers migrations added for parity work (notably `039`-`052`).

## Rollback Rules

1. Prefer feature-flag/config rollback before schema rollback.
2. Rollback SQL should only run after application traffic is drained.
3. Data-destructive rollback requires snapshot/backup restore point.

## Safe Rollback Strategy

- Step 1: Disable feature flags/routes that depend on new schema.
- Step 2: Redeploy previous app version.
- Step 3: Keep additive schema in place when possible.
- Step 4: If hard rollback is required, drop newest dependent objects first.

## Migration Notes

- `050_agent_routing.sql`: additive tables/indexes; safe to leave in place when rolling back app binary.
- `051_memory_advanced.sql`: additive memory adapter tables/settings; safe additive rollback via app-only revert.
- `052_mcp_overrides_and_tools.sql`: additive MCP override/tool catalog tables; safe additive rollback via app-only revert.

## Hard Rollback Example (last resort)

```sql
BEGIN;
DROP TABLE IF EXISTS mcp_server_tools;
DROP TABLE IF EXISTS mcp_chat_overrides;
COMMIT;
```

Only execute hard rollback if app fallback cannot operate with additive schema present.
