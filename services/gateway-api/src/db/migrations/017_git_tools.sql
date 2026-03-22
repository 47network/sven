-- Register Git Operations Tools

INSERT INTO tools (
  name,
  description,
  enabled,
  permissions_required,
  inputs_schema,
  outputs_schema,
  max_memory_mb,
  max_cpu_shares,
  max_bytes,
  timeout_seconds,
  execution_mode,
  created_at
) VALUES
(
  'git.status',
  'Get repository status (current branch, staged changes, uncommitted changes, untracked files)',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "repo_id": {
        "type": "string",
        "description": "Repository ID"
      }
    },
    "required": ["repo_id"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "current_branch": { "type": "string" },
      "staged": { "type": "array", "items": { "type": "string" } },
      "unstaged": { "type": "array", "items": { "type": "string" } },
      "untracked": { "type": "array", "items": { "type": "string" } },
      "is_dirty": { "type": "boolean" }
    }
  }'::JSONB,
  256,
  512,
  2097152,
  10,
  'in_process',
  NOW()
),
(
  'git.diff',
  'Show diff between branches or commits. Supports unified format output.',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "repo_id": { "type": "string" },
      "base_ref": { "type": "string", "description": "Base branch/commit (default: HEAD)" },
      "head_ref": { "type": "string", "description": "Head branch/commit (default: working tree)" },
      "file_pattern": { "type": "string", "description": "Optional glob pattern to filter files" },
      "max_lines": { "type": "integer", "description": "Max lines to return (default: 1000)" }
    },
    "required": ["repo_id"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "files_changed": { "type": "integer" },
      "insertions": { "type": "integer" },
      "deletions": { "type": "integer" },
      "diff": { "type": "string" }
    }
  }'::JSONB,
  512,
  512,
  5242880,
  15,
  'in_process',
  NOW()
),
(
  'git.log',
  'Show commit history for a branch. Supports filtering by author, date range, commit message.',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "repo_id": { "type": "string" },
      "branch": { "type": "string", "description": "Branch name (default: current)" },
      "max_commits": { "type": "integer", "description": "Max commits to return (default: 20)" },
      "author": { "type": "string", "description": "Filter by author email" },
      "since": { "type": "string", "description": "ISO 8601 date start" },
      "until": { "type": "string", "description": "ISO 8601 date end" }
    },
    "required": ["repo_id"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "commits": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "hash": { "type": "string" },
            "author": { "type": "string" },
            "message": { "type": "string" },
            "date": { "type": "string" }
          }
        }
      }
    }
  }'::JSONB,
  256,
  512,
  2097152,
  10,
  'in_process',
  NOW()
),
(
  'git.create_branch',
  'Create a new branch from a source branch or commit. Requires approval if dangerous (e.g., from main).',
  true,
  ARRAY['repo_write']::TEXT[],
  '{
    "type": "object",
    "properties": {
      "repo_id": { "type": "string" },
      "branch_name": { "type": "string", "description": "New branch name" },
      "from_ref": { "type": "string", "description": "Source branch/commit (default: default_branch)" }
    },
    "required": ["repo_id", "branch_name"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "branch": { "type": "string" },
      "source": { "type": "string" },
      "created": { "type": "boolean" }
    }
  }'::JSONB,
  256,
  512,
  1048576,
  10,
  'in_process',
  NOW()
),
(
  'git.commit',
  'Create a commit with staged changes. Message required. Safe for any branch except protected branches (requires approval).',
  true,
  ARRAY['repo_write']::TEXT[],
  '{
    "type": "object",
    "properties": {
      "repo_id": { "type": "string" },
      "message": { "type": "string", "description": "Commit message (required)" },
      "author_name": { "type": "string", "description": "Override author name (optional)" },
      "author_email": { "type": "string", "description": "Override author email (optional)" }
    },
    "required": ["repo_id", "message"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "commit_hash": { "type": "string" },
      "branch": { "type": "string" },
      "message": { "type": "string" },
      "files_changed": { "type": "integer" }
    }
  }'::JSONB,
  256,
  512,
  1048576,
  15,
  'in_process',
  NOW()
),
(
  'git.create_pull_request',
  'Create a pull request (merge request). Title and description required. Safe by default.',
  true,
  ARRAY['repo_write']::TEXT[],
  '{
    "type": "object",
    "properties": {
      "repo_id": { "type": "string" },
      "title": { "type": "string" },
      "description": { "type": "string" },
      "source_branch": { "type": "string", "description": "Feature branch" },
      "target_branch": { "type": "string", "description": "Target branch (default: default_branch)" },
      "auto_merge": { "type": "boolean", "description": "Auto-merge on approval (default: false)" }
    },
    "required": ["repo_id", "title", "source_branch"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "pr_id": { "type": "string" },
      "pr_number": { "type": ["integer", "null"] },
      "title": { "type": "string" },
      "url": { "type": "string" },
      "status": { "type": "string" }
    }
  }'::JSONB,
  256,
  512,
  1048576,
  15,
  'in_process',
  NOW()
),
(
  'git.merge_pull_request',
  'Merge a pull request. Requires approval for main/protected branches. Can squash or do regular merge.',
  true,
  ARRAY['repo_write']::TEXT[],
  '{
    "type": "object",
    "properties": {
      "pr_id": { "type": "string", "description": "Pull request ID" },
      "merge_method": { "type": "string", "enum": ["merge", "squash", "rebase"], "description": "Merge strategy (default: merge)" },
      "delete_branch": { "type": "boolean", "description": "Delete source branch after merge (default: true)" }
    },
    "required": ["pr_id"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "pr_id": { "type": "string" },
      "merged": { "type": "boolean" },
      "merge_commit": { "type": "string" }
    }
  }'::JSONB,
  256,
  512,
  1048576,
  20,
  'in_process',
  NOW()
),
(
  'git.diff_preview',
  'Preview what will change in a pull request. Shows file changes, insertions, deletions.',
  true,
  ARRAY[]::TEXT[],
  '{
    "type": "object",
    "properties": {
      "pr_id": { "type": "string", "description": "Pull request ID" }
    },
    "required": ["pr_id"],
    "additionalProperties": false
  }'::JSONB,
  '{
    "type": "object",
    "properties": {
      "pr_id": { "type": "string" },
      "files_changed": { "type": "integer" },
      "insertions": { "type": "integer" },
      "deletions": { "type": "integer" },
      "diff_summary": { "type": "string" }
    }
  }'::JSONB,
  256,
  512,
  2097152,
  10,
  'in_process',
  NOW()
);
