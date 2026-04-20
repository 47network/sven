-- Migration: Bootstrap 47Dynamics as isolated legacy tenant on TheSven
-- This creates the organization, service user, agent, API key infrastructure,
-- and NATS routing configuration for the 47Dynamics platform to consume
-- TheSven AI services via gRPC bridge.
--
-- Rollback: DROP the rows inserted (no schema changes, pure data seeding).

BEGIN;

-- ─── 1. Create the 47Dynamics legacy organization ───────────────────────────
-- This org is tenant-isolated: all agents, chats, memories, RAG indices,
-- and tool runs for 47Dynamics live under this organization scope.

INSERT INTO organizations (id, slug, name, owner_user_id, created_at, updated_at)
VALUES (
  '47dynamics-legacy-org',
  '47dynamics-legacy',
  '47Dynamics Platform (Legacy Tenant)',
  '47',  -- references primary admin user seeded at deploy
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Create service user for machine-to-machine auth ─────────────────────
-- This user represents the 47Dynamics platform itself, not a human operator.
-- It authenticates via A2A API key, never via interactive login.

INSERT INTO users (id, username, display_name, role, created_at, updated_at)
VALUES (
  '47dynamics-svc',
  '47dynamics-service',
  '47Dynamics Service Account',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Link service user to the 47dynamics organization as owner
INSERT INTO organization_memberships (organization_id, user_id, role, status, created_at, updated_at)
VALUES (
  '47dynamics-legacy-org',
  '47dynamics-svc',
  'owner',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Also link the primary admin user
INSERT INTO organization_memberships (organization_id, user_id, role, status, created_at, updated_at)
VALUES (
  '47dynamics-legacy-org',
  '47',
  'admin',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ─── 3. Create the 47Dynamics copilot agent ─────────────────────────────────
-- This agent handles all AI queries from 47Dynamics: copilot Q&A, runbook
-- suggestions, action proposals, and domain knowledge retrieval.

INSERT INTO agents (id, name, workspace_path, model, status, created_at, updated_at)
VALUES (
  '47dynamics-copilot',
  '47Dynamics RMM Copilot',
  '/agents/47dynamics-copilot',
  'auto',  -- model selected by LLM router based on profile
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO agent_configs (agent_id, system_prompt, model_name, profile_name, settings)
VALUES (
  '47dynamics-copilot',
  E'You are the AI copilot for the 47Dynamics RMM/MSP platform. You assist IT administrators and managed service providers with:\n\n1. **Device Management**: Answering questions about device inventory, status, health, and configuration.\n2. **Alert Triage**: Analyzing alerts, suggesting root causes, and recommending runbook-based remediation.\n3. **Patch Management**: Advising on patch deployment strategies, compatibility, and scheduling.\n4. **Security**: Identifying security findings, recommending hardening steps, and explaining threat assessments.\n5. **Automation**: Suggesting automation workflows, evaluating script safety, and proposing action plans.\n6. **Billing & PSA**: Helping with ticket management, SLA tracking, and billing queries.\n\nYou have access to indexed domain knowledge including device documentation, patch catalogs, KB articles, security advisories, and operational runbooks.\n\nAlways cite your sources. When suggesting actions that modify systems, flag the risk level (low/medium/high/critical) and recommend human approval for medium+ risk.\n\nYou operate under the 47Dynamics tenant isolation boundary. Never reference or access data from other tenants.',
  'auto',
  'performance',
  '{"capabilities": ["rag_search", "runbook_lookup", "device_context", "alert_context", "action_proposal"], "memory_index_sessions_enabled": true, "tenant_type": "legacy_platform", "source_platform": "47dynamics"}'::jsonb
)
ON CONFLICT (agent_id) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  settings = EXCLUDED.settings,
  profile_name = EXCLUDED.profile_name;

-- ─── 4. Create the HQ chat for 47Dynamics agent ────────────────────────────
-- All service-account interactions route through this internal chat context.

INSERT INTO chats (id, name, type, organization_id, created_at, updated_at)
VALUES (
  '47dynamics-hq',
  '47Dynamics Service Channel',
  'hq',
  '47dynamics-legacy-org',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_members (chat_id, user_id, role, created_at)
VALUES
  ('47dynamics-hq', '47dynamics-svc', 'owner', NOW()),
  ('47dynamics-hq', '47', 'admin', NOW())
ON CONFLICT (chat_id, user_id) DO NOTHING;

-- ─── 5. Create agent routing rule ──────────────────────────────────────────
-- Routes all messages on the "47dynamics" channel to the copilot agent.

INSERT INTO agent_routing_rules (id, agent_id, session_id, channel, priority, enabled, created_at)
VALUES (
  '47dynamics-routing-default',
  '47dynamics-copilot',
  '47dynamics-hq',
  '47dynamics',
  1,
  true,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ─── 6. Settings for the 47Dynamics tenant ──────────────────────────────────

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES
  ('47dynamics.tenant.enabled', 'true', NOW(), '47dynamics-svc'),
  ('47dynamics.tenant.rate_limit.rpm', '120', NOW(), '47dynamics-svc'),
  ('47dynamics.tenant.rate_limit.window_ms', '60000', NOW(), '47dynamics-svc'),
  ('47dynamics.tenant.model.default', 'auto', NOW(), '47dynamics-svc'),
  ('47dynamics.tenant.rag.collections', 'device_docs,patch_catalog,kb_articles,security_advisories,runbooks,ticket_history,monitoring_data', NOW(), '47dynamics-svc'),
  ('47dynamics.tenant.isolation.mode', 'strict', NOW(), '47dynamics-svc')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

COMMIT;
