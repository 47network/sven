-- 9.3 Git Operations Integration
-- Support for local repos, Forgejo, and GitHub

CREATE TABLE git_repos (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('local', 'forgejo', 'github')),
    repo_name       TEXT NOT NULL,
    repo_owner      TEXT,                  -- null for local repos
    repo_url        TEXT NOT NULL,         -- file path for local, https URL for remote
    ssh_key_ref     TEXT,                  -- secret ref for SSH auth (optional)
    token_ref       TEXT,                  -- secret ref for API token (Forgejo/GitHub)
    default_branch  TEXT NOT NULL DEFAULT 'main',
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at  TIMESTAMPTZ,
    sync_error      TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',  -- provider-specific data
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_git_repos_user ON git_repos(user_id);
CREATE INDEX idx_git_repos_provider ON git_repos(provider);
CREATE INDEX idx_git_repos_enabled ON git_repos(enabled);
CREATE UNIQUE INDEX idx_git_repos_user_url ON git_repos(user_id, repo_url);

-- Pull request tracking (created via tools)
CREATE TABLE git_pull_requests (
    id              TEXT PRIMARY KEY,
    repo_id         TEXT NOT NULL REFERENCES git_repos(id) ON DELETE CASCADE,
    pr_number       INT,                   -- null for local repos
    provider_id     TEXT UNIQUE,           -- provider's ID (for lookups)
    title           TEXT NOT NULL,
    description     TEXT,
    source_branch   TEXT NOT NULL,
    target_branch   TEXT NOT NULL,
    author          TEXT,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'merged', 'draft')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    merged_at       TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    external_url    TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'  -- commits, changes, etc.
);

CREATE INDEX idx_git_pull_requests_repo ON git_pull_requests(repo_id);
CREATE INDEX idx_git_pull_requests_status ON git_pull_requests(status);
CREATE INDEX idx_git_pull_requests_provider ON git_pull_requests(provider_id);

-- Commit tracking (created via tools)
CREATE TABLE git_commits (
    id              TEXT PRIMARY KEY,
    repo_id         TEXT NOT NULL REFERENCES git_repos(id) ON DELETE CASCADE,
    commit_hash     TEXT NOT NULL,
    author          TEXT NOT NULL,
    message         TEXT NOT NULL,
    branch          TEXT NOT NULL,
    changes         JSONB NOT NULL DEFAULT '{}',  -- { files_added, files_modified, files_deleted, insertions, deletions }
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(repo_id, commit_hash)
);

CREATE INDEX idx_git_commits_repo ON git_commits(repo_id);
CREATE INDEX idx_git_commits_branch ON git_commits(repo_id, branch);
CREATE INDEX idx_git_commits_hash ON git_commits(commit_hash);

-- Git operations log for audit
CREATE TABLE git_operations (
    id              TEXT PRIMARY KEY,
    repo_id         TEXT NOT NULL REFERENCES git_repos(id) ON DELETE CASCADE,
    operation_type  TEXT NOT NULL CHECK (operation_type IN ('clone', 'pull', 'push', 'commit', 'branch', 'pr_create', 'pr_merge', 'status', 'diff', 'log')),
    branch          TEXT,
    details         JSONB NOT NULL DEFAULT '{}',  -- operation-specific data
    status          TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'in_progress')),
    error_message   TEXT,
    triggered_by    TEXT,                  -- user_id or 'system'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_git_operations_repo ON git_operations(repo_id);
CREATE INDEX idx_git_operations_type ON git_operations(operation_type);
CREATE INDEX idx_git_operations_status ON git_operations(status);
