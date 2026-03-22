# Failure Mode Check

Generated: 2026-02-21T16:35:39.864Z
API base: http://localhost:3000
Status: pass

## Scenarios
- postgres_pool_exhaustion: skipped
  reason: Missing one or more required env commands: FM_POSTGRES_INDUCE_CMD, FM_POSTGRES_VERIFY_DEGRADED_CMD, FM_POSTGRES_RECOVER_CMD, FM_POSTGRES_VERIFY_RECOVERED_CMD
- nats_disconnect: skipped
  reason: Missing one or more required env commands: FM_NATS_INDUCE_CMD, FM_NATS_VERIFY_DEGRADED_CMD, FM_NATS_RECOVER_CMD, FM_NATS_VERIFY_RECOVERED_CMD
- opensearch_down: skipped
  reason: Missing one or more required env commands: FM_OPENSEARCH_INDUCE_CMD, FM_OPENSEARCH_VERIFY_DEGRADED_CMD, FM_OPENSEARCH_RECOVER_CMD, FM_OPENSEARCH_VERIFY_RECOVERED_CMD
- llm_provider_down: skipped
  reason: Missing one or more required env commands: FM_LLM_INDUCE_CMD, FM_LLM_VERIFY_DEGRADED_CMD, FM_LLM_RECOVER_CMD, FM_LLM_VERIFY_RECOVERED_CMD
- disk_full: passed
- oom_restart: passed

## Env Command Contract
- For each scenario, set four env vars:
- `<PREFIX>_INDUCE_CMD`
- `<PREFIX>_VERIFY_DEGRADED_CMD`
- `<PREFIX>_RECOVER_CMD`
- `<PREFIX>_VERIFY_RECOVERED_CMD`

Prefixes:
- `FM_POSTGRES`, `FM_NATS`, `FM_OPENSEARCH`, `FM_LLM`, `FM_DISK`, `FM_OOM`

