BEGIN;

ALTER TABLE mcp_servers
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE mcp_server_tools
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE mcp_tool_calls
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE mcp_chat_overrides
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

DO $$
DECLARE
  org_count INTEGER := 0;
  fallback_org_id TEXT := NULL;
BEGIN
  SELECT COUNT(*)::int, MIN(id)::text
  INTO org_count, fallback_org_id
  FROM organizations;

  IF org_count = 1 AND fallback_org_id IS NOT NULL THEN
    UPDATE mcp_servers
    SET organization_id = fallback_org_id
    WHERE organization_id IS NULL;

    UPDATE mcp_server_tools t
    SET organization_id = s.organization_id
    FROM mcp_servers s
    WHERE t.server_id = s.id
      AND t.organization_id IS NULL
      AND s.organization_id IS NOT NULL;

    UPDATE mcp_tool_calls c
    SET organization_id = s.organization_id
    FROM mcp_servers s
    WHERE c.server_id = s.id
      AND c.organization_id IS NULL
      AND s.organization_id IS NOT NULL;

    UPDATE mcp_chat_overrides o
    SET organization_id = c.organization_id
    FROM chats c
    WHERE o.chat_id = c.id
      AND o.organization_id IS NULL
      AND c.organization_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mcp_servers_org_created_at
  ON mcp_servers (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_server_tools_org_server
  ON mcp_server_tools (organization_id, server_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_org_created_at
  ON mcp_tool_calls (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_chat_overrides_org_chat
  ON mcp_chat_overrides (organization_id, chat_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mcp_server_tools_org_qualified_name
  ON mcp_server_tools (organization_id, qualified_name)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mcp_chat_overrides_org_chat_server
  ON mcp_chat_overrides (organization_id, chat_id, server_id)
  WHERE organization_id IS NOT NULL;

COMMIT;
