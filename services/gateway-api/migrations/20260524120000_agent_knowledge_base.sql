-- Batch 51: Agent Knowledge Base & Documentation
-- Agents create, curate, and share knowledge articles, FAQs, runbooks,
-- and documentation for institutional memory.

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  content          TEXT NOT NULL,
  summary          TEXT,
  category         TEXT NOT NULL DEFAULT 'general',
  article_type     TEXT NOT NULL DEFAULT 'article',
  status           TEXT NOT NULL DEFAULT 'draft',
  visibility       TEXT NOT NULL DEFAULT 'internal',
  version          INTEGER NOT NULL DEFAULT 1,
  parent_id        TEXT REFERENCES knowledge_articles(id),
  tags             JSONB DEFAULT '[]',
  metadata         JSONB DEFAULT '{}',
  view_count       INTEGER NOT NULL DEFAULT 0,
  helpful_count    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_revisions (
  id               TEXT PRIMARY KEY,
  article_id       TEXT NOT NULL REFERENCES knowledge_articles(id),
  revision_number  INTEGER NOT NULL,
  content          TEXT NOT NULL,
  summary          TEXT,
  change_note      TEXT,
  author_agent_id  TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id, revision_number)
);

CREATE TABLE IF NOT EXISTS knowledge_categories (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  description      TEXT,
  parent_id        TEXT REFERENCES knowledge_categories(id),
  icon             TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  article_count    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_feedback (
  id               TEXT PRIMARY KEY,
  article_id       TEXT NOT NULL REFERENCES knowledge_articles(id),
  agent_id         TEXT,
  feedback_type    TEXT NOT NULL DEFAULT 'helpful',
  comment          TEXT,
  rating           INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_search_index (
  id               TEXT PRIMARY KEY,
  article_id       TEXT NOT NULL REFERENCES knowledge_articles(id),
  search_vector    TSVECTOR,
  last_indexed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for knowledge_articles
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_agent ON knowledge_articles(agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_type ON knowledge_articles(article_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_status ON knowledge_articles(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_visibility ON knowledge_articles(visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_parent ON knowledge_articles(parent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_created ON knowledge_articles(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_updated ON knowledge_articles(updated_at);

-- Indexes for knowledge_revisions
CREATE INDEX IF NOT EXISTS idx_knowledge_revisions_article ON knowledge_revisions(article_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_revisions_author ON knowledge_revisions(author_agent_id);

-- Indexes for knowledge_categories
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_parent ON knowledge_categories(parent_id);

-- Indexes for knowledge_feedback
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_article ON knowledge_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_agent ON knowledge_feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_type ON knowledge_feedback(feedback_type);

-- Indexes for knowledge_search_index
CREATE INDEX IF NOT EXISTS idx_knowledge_search_article ON knowledge_search_index(article_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_search_vector ON knowledge_search_index USING gin(search_vector);
