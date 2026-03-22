-- Migration 091: Local skills registry source for bundled skills directory

INSERT INTO registry_sources (id, name, type, path, enabled, created_at)
SELECT gen_random_uuid()::text, 'local-skills', 'local', '/app/skills', TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM registry_sources WHERE name = 'local-skills');
