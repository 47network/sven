-- Batch 185: Agent Backup Orchestrator
-- Manages backup schedules, retention policies, restoration, and disaster recovery

CREATE TABLE IF NOT EXISTS agent_backup_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    plan_name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'database' CHECK (source_type IN ('database','filesystem','volume','snapshot','application','full_system')),
    source_path TEXT NOT NULL,
    destination TEXT NOT NULL,
    schedule_cron TEXT NOT NULL DEFAULT '0 2 * * *',
    retention_days INTEGER NOT NULL DEFAULT 30,
    retention_count INTEGER NOT NULL DEFAULT 10,
    compression TEXT NOT NULL DEFAULT 'gzip' CHECK (compression IN ('none','gzip','zstd','lz4','snappy')),
    encryption BOOLEAN NOT NULL DEFAULT true,
    incremental BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled','archived')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_backup_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES agent_backup_plans(id),
    job_type TEXT NOT NULL DEFAULT 'scheduled' CHECK (job_type IN ('scheduled','manual','pre_deploy','disaster_recovery')),
    size_bytes BIGINT NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    files_count INTEGER NOT NULL DEFAULT 0,
    checksum TEXT,
    storage_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled','verifying')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_backup_restores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES agent_backup_jobs(id),
    restore_target TEXT NOT NULL,
    restore_type TEXT NOT NULL DEFAULT 'full' CHECK (restore_type IN ('full','partial','point_in_time','selective')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','restoring','completed','failed','verified')),
    restored_files INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    verification_passed BOOLEAN,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_backup_plans_agent ON agent_backup_plans(agent_id);
CREATE INDEX idx_agent_backup_jobs_plan ON agent_backup_jobs(plan_id);
CREATE INDEX idx_agent_backup_jobs_status ON agent_backup_jobs(status);
CREATE INDEX idx_agent_backup_restores_job ON agent_backup_restores(job_id);
CREATE INDEX idx_agent_backup_restores_status ON agent_backup_restores(status);
