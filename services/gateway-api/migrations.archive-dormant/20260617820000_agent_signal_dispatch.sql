-- Batch 145: Agent Signal Dispatch
-- Inter-agent signalling and message routing

CREATE TABLE IF NOT EXISTS agent_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID NOT NULL REFERENCES agents(id),
  signal_kind     TEXT NOT NULL CHECK (signal_kind IN ('command','query','event','alert','heartbeat','shutdown','restart')),
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical','high','normal','low','background')),
  payload         JSONB NOT NULL DEFAULT '{}',
  ttl_seconds     INTEGER NOT NULL DEFAULT 300,
  dispatch_mode   TEXT NOT NULL DEFAULT 'broadcast' CHECK (dispatch_mode IN ('broadcast','unicast','multicast','anycast')),
  delivered_count INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signal_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id),
  signal_kind     TEXT NOT NULL,
  filter_pattern  TEXT,
  callback_url    TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  received_count  INTEGER NOT NULL DEFAULT 0,
  last_received   TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, signal_kind, filter_pattern)
);

CREATE TABLE IF NOT EXISTS signal_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id       UUID NOT NULL REFERENCES agent_signals(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES agents(id),
  subscription_id UUID REFERENCES signal_subscriptions(id),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','acknowledged','failed','expired')),
  delivered_at    TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_sender ON agent_signals(sender_id);
CREATE INDEX IF NOT EXISTS idx_signals_kind ON agent_signals(signal_kind);
CREATE INDEX IF NOT EXISTS idx_signal_subs_agent ON signal_subscriptions(agent_id);
CREATE INDEX IF NOT EXISTS idx_signal_subs_kind ON signal_subscriptions(signal_kind);
CREATE INDEX IF NOT EXISTS idx_signal_deliv_signal ON signal_deliveries(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_deliv_recipient ON signal_deliveries(recipient_id);
