CREATE TABLE IF NOT EXISTS agent_release_tagger_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  tagging_strategy TEXT NOT NULL DEFAULT 'semver',
  auto_changelog BOOLEAN NOT NULL DEFAULT true,
  sign_tags BOOLEAN NOT NULL DEFAULT false,
  protected_branches TEXT[] NOT NULL DEFAULT ARRAY['main','production'],
  release_notes_template TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_release_tagger_agent ON agent_release_tagger_configs(agent_id);
CREATE INDEX idx_release_tagger_enabled ON agent_release_tagger_configs(enabled);
