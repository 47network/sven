-- Section 17: Knowledge Graph Tables
-- Stores entities, relations, and evidence for graph-backed answers

CREATE TABLE IF NOT EXISTS kg_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'person', 'place', 'concept', 'event', 'organization', etc.
  name TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}', -- entity properties
  confidence DECIMAL(3, 2) DEFAULT 1.0, -- 0-1 extraction confidence
  created_by TEXT NOT NULL REFERENCES users(id),
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kg_relations (
  id TEXT PRIMARY KEY,
  source_entity_id TEXT NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  target_entity_id TEXT NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL, -- 'knows', 'works_for', 'part_of', 'created', etc.
  confidence DECIMAL(3, 2) DEFAULT 1.0,
  metadata JSONB DEFAULT '{}', -- relation properties
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kg_evidence (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES kg_entities(id) ON DELETE CASCADE,
  relation_id TEXT REFERENCES kg_relations(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- 'message', 'artifact', 'document', 'url'
  source_id TEXT NOT NULL, -- chat message id, artifact id, etc.
  source_chat_id TEXT REFERENCES chats(id) ON DELETE SET NULL,
  quote TEXT, -- exact text from source
  context TEXT, -- surrounding text for clarity
  confidence DECIMAL(3, 2) DEFAULT 1.0,
  extraction_method TEXT, -- 'llm', 'spacy', 'manual', 'automated'
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS kg_subgraphs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  entity_ids TEXT[] DEFAULT '{}', -- subset of entities
  relation_ids TEXT[] DEFAULT '{}', -- subset of relations
  is_public BOOLEAN DEFAULT false,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kg_answer_citations (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES kg_entities(id) ON DELETE SET NULL,
  relation_id TEXT REFERENCES kg_relations(id) ON DELETE SET NULL,
  evidence_id TEXT REFERENCES kg_evidence(id) ON DELETE SET NULL,
  citation_text TEXT, -- how it was cited in the answer
  position_in_message INT, -- character offset
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kg_extraction_jobs (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
  artifact_id TEXT,
  job_type TEXT NOT NULL, -- 'entity', 'relation', 'full_analysis'
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  result_entities INT DEFAULT 0,
  result_relations INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_kg_entities_type ON kg_entities(type);
CREATE INDEX idx_kg_entities_name ON kg_entities USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_kg_relations_source_target ON kg_relations(source_entity_id, target_entity_id);
CREATE INDEX idx_kg_relations_type ON kg_relations(relation_type);
CREATE INDEX idx_kg_evidence_entity ON kg_evidence(entity_id);
CREATE INDEX idx_kg_evidence_relation ON kg_evidence(relation_id);
CREATE INDEX idx_kg_evidence_source ON kg_evidence(source_id, source_chat_id);
CREATE INDEX idx_kg_subgraphs_chat ON kg_subgraphs(chat_id);
CREATE INDEX idx_kg_answer_citations_message ON kg_answer_citations(message_id, chat_id);
CREATE INDEX idx_kg_extraction_status ON kg_extraction_jobs(status, chat_id);
