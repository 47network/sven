# Wave 2 LibreChat Workflow Matrix (2026-03-16)

This matrix is the strict source of truth for LibreChat parity Wave 2 (LC-W01..LC-W10).

| ID | Capability | Status |
| --- | --- | --- |
| LC-W01 | Multi-provider model UX (`/model list/current/select`) | implemented |
| LC-W02 | MCP/tool discovery + operator-safe listing flow | implemented |
| LC-W03 | Role/operator controls over model switching and admin actions | implemented |
| LC-W04 | Session export/import continuity workflow | implemented |
| LC-W05 | Slash-command ergonomics parity (help, aliases, directive mode) | implemented |
| LC-W06 | Tool execution reliability with bounded retries and clear error surfacing | implemented |
| LC-W07 | Tenant/session boundary safety for provider and tool settings | implemented |
| LC-W08 | Conversation observability for operators (queue/state diagnostics) | implemented |
| LC-W09 | Agent handoff and continuation in same thread | implemented |
| LC-W10 | Policy-aware enterprise defaults (safe-by-default runtime behavior) | implemented |

## Contract Test Bindings

| Lane | Contract Test ID |
| --- | --- |
| LC-W01 | librechat_parity_w01_model_provider_ux_contract |
| LC-W02 | librechat_parity_w02_mcp_tool_discovery_contract |
| LC-W03 | librechat_parity_w03_operator_control_contract |
| LC-W04 | librechat_parity_w04_session_portability_contract |
| LC-W05 | librechat_parity_w05_command_ergonomics_contract |
| LC-W06 | librechat_parity_w06_tool_reliability_contract |
| LC-W07 | librechat_parity_w07_tenant_boundary_contract |
| LC-W08 | librechat_parity_w08_operator_observability_contract |
| LC-W09 | librechat_parity_w09_handoff_continuation_contract |
| LC-W10 | librechat_parity_w10_enterprise_defaults_contract |
