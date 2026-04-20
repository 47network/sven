-- Batch 200: Fault Injector
-- Chaos engineering: inject faults, latency, errors for resilience testing

CREATE TABLE IF NOT EXISTS agent_fault_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    experiment_name TEXT NOT NULL,
    target_service TEXT NOT NULL,
    fault_type TEXT NOT NULL CHECK (fault_type IN ('latency','error','abort','throttle','corrupt','partition','cpu_stress','memory_stress')),
    severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
    config JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','completed','aborted','failed')),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL DEFAULT 60,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_fault_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES agent_fault_experiments(id),
    metric_name TEXT NOT NULL,
    baseline_value DOUBLE PRECISION,
    observed_value DOUBLE PRECISION,
    deviation_pct DOUBLE PRECISION,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
    details JSONB DEFAULT '{}',
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_fault_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES agent_fault_experiments(id),
    resilience_score DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (resilience_score >= 0 AND resilience_score <= 100),
    recovery_time_ms INTEGER,
    cascading_failures INTEGER NOT NULL DEFAULT 0,
    recommendations JSONB DEFAULT '[]',
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fault_experiments_agent ON agent_fault_experiments(agent_id);
CREATE INDEX idx_fault_experiments_status ON agent_fault_experiments(status);
CREATE INDEX idx_fault_observations_exp ON agent_fault_observations(experiment_id);
CREATE INDEX idx_fault_reports_exp ON agent_fault_reports(experiment_id);
