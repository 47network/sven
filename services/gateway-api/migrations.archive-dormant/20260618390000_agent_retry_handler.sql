-- Batch 202: Retry Handler
-- Manages retry policies, backoff strategies, and dead-letter queues

CREATE TABLE IF NOT EXISTS agent_retry_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    policy_name TEXT NOT NULL,
    target_service TEXT NOT NULL,
    max_retries INTEGER NOT NULL DEFAULT 3,
    backoff_strategy TEXT NOT NULL DEFAULT 'exponential' CHECK (backoff_strategy IN ('fixed','linear','exponential','jitter','fibonacci')),
    initial_delay_ms INTEGER NOT NULL DEFAULT 1000,
    max_delay_ms INTEGER NOT NULL DEFAULT 30000,
    retry_on_status INTEGER[] DEFAULT '{500,502,503,504}',
    retry_on_errors TEXT[] DEFAULT '{}',
    timeout_ms INTEGER NOT NULL DEFAULT 10000,
    enabled BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_retry_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES agent_retry_policies(id),
    request_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status_code INTEGER,
    error_message TEXT,
    delay_ms INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL,
    succeeded BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}',
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES agent_retry_policies(id),
    request_id TEXT NOT NULL,
    original_payload JSONB NOT NULL,
    last_error TEXT,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    reprocessed BOOLEAN NOT NULL DEFAULT false,
    reprocessed_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_retry_policies_agent ON agent_retry_policies(agent_id);
CREATE INDEX idx_retry_policies_target ON agent_retry_policies(target_service);
CREATE INDEX idx_retry_attempts_policy ON agent_retry_attempts(policy_id);
CREATE INDEX idx_retry_attempts_request ON agent_retry_attempts(request_id);
CREATE INDEX idx_dlq_policy ON agent_dead_letter_queue(policy_id);
CREATE INDEX idx_dlq_reprocessed ON agent_dead_letter_queue(reprocessed);
