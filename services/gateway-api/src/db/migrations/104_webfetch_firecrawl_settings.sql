-- Migration 104: Firecrawl fallback settings for web.fetch

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'webFetch.firecrawlEnabled', 'false'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'webFetch.firecrawlEnabled'
);

INSERT INTO settings_global (key, value, updated_at, updated_by)
SELECT 'webFetch.firecrawlApiUrl', '""'::jsonb, NOW(), 'system'
WHERE NOT EXISTS (
  SELECT 1 FROM settings_global WHERE key = 'webFetch.firecrawlApiUrl'
);
