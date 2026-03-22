-- Sprint 16 — Deployment mode: personal vs multi_user
-- Seeded to 'multi_user' (existing Sven installs are multi-user).
-- New single-user installs can flip to 'personal' via setup wizard.

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES ('deployment.mode', '"multi_user"', NOW(), 'migration')
ON CONFLICT (key) DO NOTHING;
