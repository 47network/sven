-- Migration 111: Project file tree context settings

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'projectContext.fileTree.enabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'projectContext.fileTree.enabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'projectContext.fileTree.maxDepth', '3'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'projectContext.fileTree.maxDepth'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'projectContext.fileTree.maxFilesPerDir', '50'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'projectContext.fileTree.maxFilesPerDir'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'projectContext.fileTree.excludePatterns', '[]'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'projectContext.fileTree.excludePatterns'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'projectContext.fileTree.debounceMs', '30000'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'projectContext.fileTree.debounceMs'
);
