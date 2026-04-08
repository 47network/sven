-- Migration 20260328120000: Seed model_registry with default Ollama models
-- These models must be pulled on VM5 (sven-ollama container):
--   docker exec sven-ollama ollama pull llama3.2
--   docker exec sven-ollama ollama pull llama3.1:8b
--   docker exec sven-ollama ollama pull mistral
--
-- Endpoint stored as 'ollama://local' — agent-runtime always overrides with
-- OLLAMA_URL env var at call time, so the stored value is documentation only.

DO $$
DECLARE
  v_admin_id TEXT;
  v_org_id   TEXT;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE username = '47' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'Admin user not found — skipping model_registry seed';
    RETURN;
  END IF;

  SELECT COALESCE(active_organization_id, '') INTO v_org_id
    FROM users WHERE id = v_admin_id LIMIT 1;

  IF v_org_id = '' THEN
    SELECT id INTO v_org_id FROM organizations ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- llama3.2:3b — fast, lightweight, default model (already pulled on VM5)
  INSERT INTO model_registry
    (id, name, provider, model_id, endpoint, capabilities, is_local, is_active, organization_id, created_by, created_at)
  SELECT gen_random_uuid()::text, 'llama3.2:3b', 'ollama', 'llama3.2:3b', 'ollama://local', '{chat}', TRUE, TRUE, v_org_id, v_admin_id, NOW()
  WHERE NOT EXISTS (SELECT 1 FROM model_registry WHERE provider = 'ollama' AND model_id = 'llama3.2:3b');

  -- nomic-embed-text — embeddings (already pulled on VM5)
  INSERT INTO model_registry
    (id, name, provider, model_id, endpoint, capabilities, is_local, is_active, organization_id, created_by, created_at)
  SELECT gen_random_uuid()::text, 'nomic-embed-text', 'ollama', 'nomic-embed-text', 'ollama://local', '{embed}', TRUE, TRUE, v_org_id, v_admin_id, NOW()
  WHERE NOT EXISTS (SELECT 1 FROM model_registry WHERE provider = 'ollama' AND model_id = 'nomic-embed-text');

  RAISE NOTICE 'Seeded Ollama models into model_registry';
END $$;
