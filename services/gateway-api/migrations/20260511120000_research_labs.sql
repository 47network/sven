-- Batch 38: Research Labs — agent-operated research infrastructure
-- Agents create research labs, run projects, publish papers, manage datasets

-- ── Research labs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_labs (
  id             TEXT PRIMARY KEY,
  agent_id       TEXT NOT NULL REFERENCES agent_profiles(id),
  domain_id      TEXT REFERENCES agent_service_domains(id),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  focus_area     TEXT NOT NULL CHECK (focus_area IN (
    'nlp', 'computer_vision', 'reinforcement_learning', 'data_science',
    'cybersecurity', 'economics', 'social_science', 'engineering',
    'medicine', 'environment', 'general'
  )),
  status         TEXT NOT NULL DEFAULT 'founding' CHECK (status IN (
    'founding', 'active', 'publishing', 'dormant', 'archived'
  )),
  description    TEXT NOT NULL DEFAULT '',
  capabilities   TEXT[] NOT NULL DEFAULT '{}',
  member_agent_ids TEXT[] NOT NULL DEFAULT '{}',
  papers_count   INTEGER NOT NULL DEFAULT 0,
  datasets_count INTEGER NOT NULL DEFAULT 0,
  reputation     INTEGER NOT NULL DEFAULT 0,
  tokens_funded  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_labs_agent ON research_labs(agent_id);
CREATE INDEX IF NOT EXISTS idx_research_labs_focus ON research_labs(focus_area);
CREATE INDEX IF NOT EXISTS idx_research_labs_status ON research_labs(status);

-- ── Research projects ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_projects (
  id             TEXT PRIMARY KEY,
  lab_id         TEXT NOT NULL REFERENCES research_labs(id),
  title          TEXT NOT NULL,
  abstract       TEXT NOT NULL DEFAULT '',
  methodology    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'proposal' CHECK (status IN (
    'proposal', 'approved', 'data_collection', 'analysis',
    'writing', 'peer_review', 'revision', 'published', 'archived'
  )),
  lead_agent_id  TEXT NOT NULL REFERENCES agent_profiles(id),
  collaborators  TEXT[] NOT NULL DEFAULT '{}',
  tags           TEXT[] NOT NULL DEFAULT '{}',
  budget_tokens  INTEGER NOT NULL DEFAULT 0,
  spent_tokens   INTEGER NOT NULL DEFAULT 0,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_projects_lab ON research_projects(lab_id);
CREATE INDEX IF NOT EXISTS idx_research_projects_status ON research_projects(status);
CREATE INDEX IF NOT EXISTS idx_research_projects_lead ON research_projects(lead_agent_id);

-- ── Research papers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_papers (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES research_projects(id),
  lab_id         TEXT NOT NULL REFERENCES research_labs(id),
  title          TEXT NOT NULL,
  abstract       TEXT NOT NULL DEFAULT '',
  authors        TEXT[] NOT NULL DEFAULT '{}',
  keywords       TEXT[] NOT NULL DEFAULT '{}',
  content_url    TEXT,
  doi            TEXT,
  citation_count INTEGER NOT NULL DEFAULT 0,
  peer_review_score NUMERIC(3,1),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'under_review', 'accepted', 'published', 'retracted'
  )),
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_papers_project ON research_papers(project_id);
CREATE INDEX IF NOT EXISTS idx_research_papers_lab ON research_papers(lab_id);
CREATE INDEX IF NOT EXISTS idx_research_papers_status ON research_papers(status);

-- ── Research datasets ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_datasets (
  id             TEXT PRIMARY KEY,
  lab_id         TEXT NOT NULL REFERENCES research_labs(id),
  project_id     TEXT REFERENCES research_projects(id),
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  format         TEXT NOT NULL CHECK (format IN (
    'csv', 'json', 'parquet', 'sql_dump', 'binary', 'mixed'
  )),
  size_bytes     BIGINT NOT NULL DEFAULT 0,
  record_count   BIGINT NOT NULL DEFAULT 0,
  license        TEXT NOT NULL DEFAULT 'internal',
  access_level   TEXT NOT NULL DEFAULT 'lab_only' CHECK (access_level IN (
    'public', 'marketplace', 'lab_only', 'project_only'
  )),
  storage_url    TEXT,
  checksum       TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_datasets_lab ON research_datasets(lab_id);
CREATE INDEX IF NOT EXISTS idx_research_datasets_project ON research_datasets(project_id);
