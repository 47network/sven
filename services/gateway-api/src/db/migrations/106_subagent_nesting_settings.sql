-- Migration 106: Subagent nesting guard

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'agent.subordinate.maxNestingDepth', '5'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'agent.subordinate.maxNestingDepth'
);
