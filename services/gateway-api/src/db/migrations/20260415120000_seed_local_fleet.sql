-- Migration 20260415120000: Seed inference_nodes and model_registry with real local GPU fleet
-- Part of Epic G (argentum) — Local Model Fleet
--
-- Hardware:
--   VM5 (sven-ai, 10.47.47.9): llama-server port 8080
--     GPU 0: AMD RX 9070 XT (15.9 GiB, RDNA4 gfx1201)
--     GPU 1: AMD RX 6750 XT (12.0 GiB, RDNA2 gfx1031)
--     Model: qwen2.5-coder:32b Q4_K_M, tensor-split 57/43
--
--   VM13 (kaldorei, 10.47.47.13): Ollama CUDA port 11434
--     GPU: NVIDIA RTX 3060 LHR (12 GiB, Ampere sm_86)
--     Models: qwen2.5:7b, deepseek-r1:7b, llama3.2:3b, nomic-embed-text

BEGIN;

-- ── Inference Nodes ─────────────────────────────────────────────────────

-- Update stale local-ollama seed to point at kaldorei (VM13)
UPDATE inference_nodes
SET
  endpoint_url = 'http://10.47.47.13:11434',
  node_type = 'local',
  location = 'vm13-kaldorei',
  gpu_enabled = TRUE,
  gpu_vram_gb = 12,
  supported_models = ARRAY['qwen2.5:7b', 'deepseek-r1:7b', 'llama3.2:3b', 'nomic-embed-text'],
  max_concurrent_requests = 4,
  is_healthy = TRUE,
  updated_at = NOW()
WHERE node_name = 'local-ollama';

-- VM5 power node (llama-server, dual AMD GPUs, OpenAI-compat)
INSERT INTO inference_nodes (
  node_name, endpoint_url, node_type, location,
  gpu_enabled, gpu_vram_gb, supported_models,
  max_concurrent_requests, is_healthy
) VALUES (
  'vm5-power',
  'http://10.47.47.9:8080',
  'local',
  'vm5-sven-ai',
  TRUE,
  28,
  ARRAY['qwen2.5-coder:32b'],
  2,
  TRUE
) ON CONFLICT (node_name) DO UPDATE SET
  endpoint_url = EXCLUDED.endpoint_url,
  node_type = EXCLUDED.node_type,
  location = EXCLUDED.location,
  gpu_enabled = EXCLUDED.gpu_enabled,
  gpu_vram_gb = EXCLUDED.gpu_vram_gb,
  supported_models = EXCLUDED.supported_models,
  max_concurrent_requests = EXCLUDED.max_concurrent_requests,
  updated_at = NOW();

-- VM13 fast node (Ollama, RTX 3060)
INSERT INTO inference_nodes (
  node_name, endpoint_url, node_type, location,
  gpu_enabled, gpu_vram_gb, supported_models,
  max_concurrent_requests, is_healthy
) VALUES (
  'vm13-fast',
  'http://10.47.47.13:11434',
  'local',
  'vm13-kaldorei',
  TRUE,
  12,
  ARRAY['qwen2.5:7b', 'deepseek-r1:7b', 'llama3.2:3b', 'nomic-embed-text'],
  4,
  TRUE
) ON CONFLICT (node_name) DO UPDATE SET
  endpoint_url = EXCLUDED.endpoint_url,
  node_type = EXCLUDED.node_type,
  location = EXCLUDED.location,
  gpu_enabled = EXCLUDED.gpu_enabled,
  gpu_vram_gb = EXCLUDED.gpu_vram_gb,
  supported_models = EXCLUDED.supported_models,
  max_concurrent_requests = EXCLUDED.max_concurrent_requests,
  updated_at = NOW();

-- ── Model Registry ──────────────────────────────────────────────────────
-- Seed all actually deployed local models. Uses org/admin lookup pattern
-- from the existing seed_ollama_models migration.

DO $$
DECLARE
  v_admin_id TEXT;
  v_org_id   TEXT;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE username = '47' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'Admin user not found — skipping model_registry fleet seed';
    RETURN;
  END IF;

  SELECT COALESCE(active_organization_id, '') INTO v_org_id
    FROM users WHERE id = v_admin_id LIMIT 1;
  IF v_org_id = '' THEN
    SELECT id INTO v_org_id FROM organizations ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- qwen2.5-coder:32b on VM5 (llama-server, dual AMD GPUs)
  INSERT INTO model_registry
    (id, name, provider, model_id, endpoint, capabilities, is_local, is_active,
     organization_id, created_by, metadata, created_at)
  SELECT
    gen_random_uuid()::text,
    'Qwen 2.5 Coder 32B',
    'llama-server',
    'qwen2.5-coder:32b',
    'http://10.47.47.9:8080/v1',
    '{coding,reasoning,chat,summarization}',
    TRUE, TRUE,
    v_org_id, v_admin_id,
    '{"runtime":"llama-server","quantVariant":"Q4_K_M","vramMb":18500,"hostDevice":"vm5-sven-ai","apiFormat":"openai","tensorSplit":"57/43","gpus":["RX 9070 XT","RX 6750 XT"]}'::jsonb,
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM model_registry
    WHERE provider = 'llama-server' AND model_id = 'qwen2.5-coder:32b'
  );

  -- qwen2.5:7b on VM13 (Ollama, RTX 3060)
  INSERT INTO model_registry
    (id, name, provider, model_id, endpoint, capabilities, is_local, is_active,
     organization_id, created_by, metadata, created_at)
  SELECT
    gen_random_uuid()::text,
    'Qwen 2.5 7B',
    'ollama',
    'qwen2.5:7b',
    'http://10.47.47.13:11434',
    '{coding,reasoning,chat,summarization,translation}',
    TRUE, TRUE,
    v_org_id, v_admin_id,
    '{"runtime":"ollama","vramMb":4500,"hostDevice":"vm13-kaldorei","apiFormat":"ollama","gpu":"RTX 3060"}'::jsonb,
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM model_registry
    WHERE provider = 'ollama' AND model_id = 'qwen2.5:7b'
  );

  -- deepseek-r1:7b on VM13 (Ollama, RTX 3060)
  INSERT INTO model_registry
    (id, name, provider, model_id, endpoint, capabilities, is_local, is_active,
     organization_id, created_by, metadata, created_at)
  SELECT
    gen_random_uuid()::text,
    'DeepSeek R1 7B',
    'ollama',
    'deepseek-r1:7b',
    'http://10.47.47.13:11434',
    '{reasoning,coding,chat}',
    TRUE, TRUE,
    v_org_id, v_admin_id,
    '{"runtime":"ollama","vramMb":4500,"hostDevice":"vm13-kaldorei","apiFormat":"ollama","gpu":"RTX 3060"}'::jsonb,
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM model_registry
    WHERE provider = 'ollama' AND model_id = 'deepseek-r1:7b'
  );

  RAISE NOTICE 'Seeded local GPU fleet into model_registry and inference_nodes';
END $$;

COMMIT;
