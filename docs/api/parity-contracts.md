# Parity API Contract Notes

Primary shared contracts are defined in `packages/shared/src/types/api.ts`.

Current parity-related contract groups:
- Agent routing and orchestration
- MCP server/tool metadata and chat overrides
- SOUL registry entries, install/activation responses
- Thinking level and session-level reasoning controls

Rev 3/4 contract groups (to be added):
- OpenAI-compatible API endpoints (`/v1/chat/completions`, `/v1/models`) — drop-in Chat Completions + Responses API
- LiteLLM proxy configuration and virtual key management — provider routing, cost tracking, spend limits
- Security audit CLI contracts — check results, remediation actions, severity levels, `--fix` mode diffs
- Config includes resolution — `$include` directive processing, fragment merge semantics, nesting depth validation
- Scheduler/cron API — scheduled task CRUD, execution history, notification configuration
- Context viewer debug API — `GET /v1/admin/debug/context/:sessionId` full context assembly
- Memory dashboard API — bulk memory operations, semantic search, import/export
- Update checker API — version comparison, release feed polling, admin notifications
- Pause/Resume agent API — agent execution state control via WebSocket events

When adding/changing route payloads:
1. Update shared types first.
2. Update gateway route validation schemas.
3. Update admin/canvas/CLI consumers.
4. Add integration/e2e coverage for changed payloads.
