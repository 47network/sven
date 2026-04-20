-- Batch 81: Agent Plugin System
-- Tables for managing agent plugins, registries, installations, and hooks

CREATE TABLE IF NOT EXISTS agent_plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  author TEXT,
  license TEXT DEFAULT 'MIT',
  category TEXT NOT NULL CHECK (category IN ('skill','integration','ui','analytics','security','storage','messaging','workflow')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','deprecated','archived','banned')),
  entry_point TEXT NOT NULL,
  hooks JSONB DEFAULT '[]',
  dependencies JSONB DEFAULT '[]',
  config_schema JSONB DEFAULT '{}',
  icon_url TEXT,
  repository_url TEXT,
  download_count INTEGER DEFAULT 0,
  rating_avg NUMERIC(3,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_installations (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES agent_plugins(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'installed' CHECK (status IN ('installed','active','disabled','errored','uninstalled')),
  config JSONB DEFAULT '{}',
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, agent_id)
);

CREATE TABLE IF NOT EXISTS plugin_hooks (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES agent_plugins(id) ON DELETE CASCADE,
  hook_type TEXT NOT NULL CHECK (hook_type IN ('before_task','after_task','on_message','on_error','on_startup','on_shutdown','on_schedule','on_event')),
  handler TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  filter_pattern TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_events (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES agent_plugins(id) ON DELETE CASCADE,
  installation_id TEXT REFERENCES plugin_installations(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('installed','activated','deactivated','updated','errored','uninstalled','hook_fired','config_changed')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_reviews (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES agent_plugins(id) ON DELETE CASCADE,
  reviewer_agent_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  helpful_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, reviewer_agent_id)
);

-- Indexes for agent_plugins
CREATE INDEX idx_agent_plugins_name ON agent_plugins(name);
CREATE INDEX idx_agent_plugins_category ON agent_plugins(category);
CREATE INDEX idx_agent_plugins_status ON agent_plugins(status);
CREATE INDEX idx_agent_plugins_author ON agent_plugins(author);

-- Indexes for plugin_installations
CREATE INDEX idx_plugin_installations_plugin ON plugin_installations(plugin_id);
CREATE INDEX idx_plugin_installations_agent ON plugin_installations(agent_id);
CREATE INDEX idx_plugin_installations_status ON plugin_installations(status);
CREATE INDEX idx_plugin_installations_version ON plugin_installations(version);

-- Indexes for plugin_hooks
CREATE INDEX idx_plugin_hooks_plugin ON plugin_hooks(plugin_id);
CREATE INDEX idx_plugin_hooks_type ON plugin_hooks(hook_type);
CREATE INDEX idx_plugin_hooks_priority ON plugin_hooks(priority DESC);
CREATE INDEX idx_plugin_hooks_enabled ON plugin_hooks(enabled);

-- Indexes for plugin_events
CREATE INDEX idx_plugin_events_plugin ON plugin_events(plugin_id);
CREATE INDEX idx_plugin_events_installation ON plugin_events(installation_id);
CREATE INDEX idx_plugin_events_type ON plugin_events(event_type);
CREATE INDEX idx_plugin_events_created ON plugin_events(created_at DESC);

-- Indexes for plugin_reviews
CREATE INDEX idx_plugin_reviews_plugin ON plugin_reviews(plugin_id);
CREATE INDEX idx_plugin_reviews_reviewer ON plugin_reviews(reviewer_agent_id);
CREATE INDEX idx_plugin_reviews_rating ON plugin_reviews(rating);
CREATE INDEX idx_plugin_reviews_created ON plugin_reviews(created_at DESC);
