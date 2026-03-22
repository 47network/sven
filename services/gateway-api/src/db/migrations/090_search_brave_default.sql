-- Migration 090: Ensure Brave is included in default search.engines

UPDATE settings_global
SET value = (
  SELECT CASE
    WHEN jsonb_typeof(value) = 'array' AND (value ? 'brave') THEN value
    WHEN jsonb_typeof(value) = 'array' THEN value || '["brave"]'::jsonb
    ELSE '["google","bing","duckduckgo","wikipedia","brave"]'::jsonb
  END
)
WHERE key = 'search.engines';

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'search.engines', '["google","bing","duckduckgo","wikipedia","brave"]'::jsonb, NOW(), 'migration:090_search_brave_default'
WHERE NOT EXISTS (SELECT 1 FROM settings_global WHERE key = 'search.engines');
