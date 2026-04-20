-- Batch 303: Message Relay
CREATE TABLE IF NOT EXISTS agent_msg_relay_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'nats', max_retries INTEGER DEFAULT 3,
  dlq_enabled BOOLEAN DEFAULT true, batch_size INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_msg_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_msg_relay_configs(id),
  channel_name TEXT NOT NULL, channel_type TEXT NOT NULL DEFAULT 'topic',
  subscribers INTEGER DEFAULT 0, messages_total BIGINT DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_msg_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), channel_id UUID NOT NULL REFERENCES agent_msg_channels(id),
  original_subject TEXT NOT NULL, payload JSONB NOT NULL, error TEXT,
  retry_count INTEGER DEFAULT 0, max_retries INTEGER DEFAULT 3,
  state TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_msg_relay_configs_agent ON agent_msg_relay_configs(agent_id);
CREATE INDEX idx_msg_channels_config ON agent_msg_channels(config_id);
CREATE INDEX idx_msg_dlq_channel ON agent_msg_dlq(channel_id);
