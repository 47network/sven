# Parity Feature Incident Runbook

## Scope
This runbook covers parity-era features (browser tools, CLI, chat commands/compaction, multi-agent routing, MCP, SOUL registry, native companions) and rev 3/4 additions (LiteLLM proxy, OpenAI-compatible API, security audit CLI, config includes, mDNS discovery, scheduler, context viewer).

## Triage

1. Confirm component health (`/health`, service logs, queue lag).
2. Identify impact scope (single feature, channel, or platform-wide).
3. Determine if write surfaces must be frozen (kill switch/lockdown).

## Immediate Actions

1. Activate kill switch for high-risk incidents.
2. Disable offending feature via config/route toggle (MCP server mode, browser write tools, SOUL activation).
3. Apply backpressure if queues are saturated.
4. Capture evidence: request ids, actor ids, affected chat/session ids.

## Component-Specific Playbooks

### Core Components (rev 1)
- **Agent Routing**: disable problematic routing rules in Admin UI, fallback to default runtime.
- **MCP**: disconnect/reconnect MCP server entries, disable chat overrides for impacted chats.
- **SOUL Registry**: deactivate install and remove trust fingerprints temporarily.
- **Browser Automation**: switch to read-only tool subset and block write actions behind approval.

### Rev 3/4 Components
- **LiteLLM Proxy**: disable proxy passthrough in LLM router config, fall back to direct provider connections. Check for API key exposure in proxy logs.
- **OpenAI-Compatible API**: disable API endpoints via route toggle, block affected API keys, review access logs for unauthorized usage.
- **Security Audit CLI**: halt any in-progress `--fix` operations, review audit remediation log for unintended changes, rollback via documented before/after diffs.
- **Config Includes**: disable `$include` processing, revert to flat config, audit include resolution log for path traversal attempts.
- **mDNS/DNS-SD Discovery**: disable discovery service, remove auto-peered instances if compromised, restrict to manual peering only.
- **Scheduler Service**: pause all scheduled tasks, review execution history for unexpected runs, disable scheduler until root cause resolved.
- **Context Viewer**: restrict debug endpoint access to admin-only, audit access logs for data exposure.

## Recovery

1. Verify error-rate and latency return to baseline.
2. Verify approval queue drains and no stuck workflows remain.
3. Run targeted e2e checks for impacted feature.
4. Re-enable feature in staged rollout.

## Post-Incident

1. Add replay harness scenario reproducing failure.
2. Update threat model and policy tests.
3. Add/adjust alerts and dashboard panels.
