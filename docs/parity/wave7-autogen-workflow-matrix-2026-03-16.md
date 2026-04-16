# Wave 7 AutoGen Workflow Matrix (2026-03-16)

This matrix is the strict source of truth for AutoGen parity Wave 7 (AG-W01..AG-W10).

| ID | Capability | Status |
| --- | --- | --- |
| AG-W01 | Multi-agent AgentChat orchestration with supervisor + delegated worker turns | implemented |
| AG-W02 | Team conversation lifecycle controls (pause/resume/terminate/restart) | implemented |
| AG-W03 | Agent role envelopes with deterministic speaker-selection policy | implemented |
| AG-W04 | Human-in-the-loop checkpoints in agent team conversations | implemented |
| AG-W05 | Tool-using assistant agent within team chat | implemented |
| AG-W06 | Code-execution agent participation with safety boundaries | implemented |
| AG-W07 | Bounded retry and recovery behavior in multi-agent chat loops | implemented |
| AG-W08 | Team transcript observability and replay diagnostics | implemented |
| AG-W09 | Org-scoped policy and isolation across team-agent conversations | implemented |
| AG-W10 | Reusable AutoGen-style team templates and packaging | implemented |

## Contract Test Bindings

| Lane | Contract Test ID | Report |
| --- | --- | --- |
| AG-W01 | autogen_parity_w01_agentchat_orchestration_contract | autogen-w01-agentchat-orchestration-latest |
| AG-W02 | autogen_parity_w02_team_lifecycle_contract | autogen-w02-team-lifecycle-latest |
| AG-W03 | autogen_parity_w03_speaker_selection_contract | autogen-w03-speaker-selection-latest |
| AG-W04 | autogen_parity_w04_hitl_checkpoints_contract | autogen-w04-hitl-checkpoints-latest |
| AG-W05 | autogen_parity_w05_team_tool_use_contract | autogen-w05-team-tool-use-latest |
| AG-W06 | autogen_parity_w06_code_execution_contract | autogen-w06-code-execution-latest |
| AG-W07 | autogen_parity_w07_retry_recovery_contract | autogen-w07-retry-recovery-latest |
| AG-W08 | autogen_parity_w08_transcript_observability_contract | autogen-w08-transcript-observability-latest |
| AG-W09 | autogen_parity_w09_team_policy_isolation_contract | autogen-w09-team-policy-isolation-latest |
| AG-W10 | autogen_parity_w10_team_packaging_contract | autogen-w10-team-packaging-latest |
