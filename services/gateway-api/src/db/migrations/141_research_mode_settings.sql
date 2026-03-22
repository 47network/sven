INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'agent.research.enabled', 'true', NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'agent.research.enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'agent.research.maxSteps', '10', NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'agent.research.maxSteps'
);
