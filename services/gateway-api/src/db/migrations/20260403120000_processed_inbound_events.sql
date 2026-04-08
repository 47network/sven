-- Deduplication table for agent-runtime inbound event processing.
-- Prevents duplicate LLM responses when NATS JetStream replays messages
-- after agent-runtime crashes or ack timeouts.
-- Records are cleaned up after 24 hours by the agent-runtime periodic task.
CREATE TABLE IF NOT EXISTS processed_inbound_events (
    event_id     TEXT PRIMARY KEY,
    chat_id      TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_inbound_events_chat
    ON processed_inbound_events (chat_id);

CREATE INDEX IF NOT EXISTS idx_processed_inbound_events_ttl
    ON processed_inbound_events (processed_at);
