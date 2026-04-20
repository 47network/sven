-- Batch 24 — Publishing Pipeline v2: Printing, Legal, POD, Trending Genres, Author Personas
-- Extends Batch 21 publishing pipeline with physical production capabilities

-- ─── POD Integrations (provider configurations) ────────────────────────
CREATE TABLE IF NOT EXISTS pod_integrations (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  provider      TEXT NOT NULL CHECK (provider IN (
    'amazon_kdp', 'ingram_spark', 'lulu', 'blurb',
    'bookbaby', 'tipografia_universul', 'custom'
  )),
  display_name  TEXT NOT NULL,
  api_endpoint  TEXT,
  credentials   JSONB NOT NULL DEFAULT '{}',
  capabilities  JSONB NOT NULL DEFAULT '{}',
  supported_formats TEXT[] NOT NULL DEFAULT '{}',
  min_order_qty INTEGER NOT NULL DEFAULT 1,
  base_cost_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  per_page_cost NUMERIC(10,4) NOT NULL DEFAULT 0,
  edge_printing BOOLEAN NOT NULL DEFAULT false,
  active        BOOLEAN NOT NULL DEFAULT true,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pod_integrations_org ON pod_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_pod_integrations_provider ON pod_integrations(provider);

-- ─── Printing Orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS printing_orders (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  project_id      TEXT NOT NULL REFERENCES publishing_projects(id),
  pod_integration_id TEXT REFERENCES pod_integrations(id),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'accepted', 'printing', 'quality_check',
    'shipped', 'delivered', 'cancelled', 'failed'
  )),
  order_type      TEXT NOT NULL CHECK (order_type IN ('pod', 'bulk', 'sample')),
  quantity        INTEGER NOT NULL DEFAULT 1,
  format          TEXT NOT NULL CHECK (format IN (
    'paperback', 'hardcover', 'special_edition'
  )),
  page_count      INTEGER,
  edge_type       TEXT CHECK (edge_type IN (
    'plain', 'stained', 'sprayed', 'foil', 'painted', 'gilded'
  )),
  edge_spec       JSONB NOT NULL DEFAULT '{}',
  print_file_url  TEXT,
  cover_file_url  TEXT,
  unit_cost_eur   NUMERIC(10,2),
  total_cost_eur  NUMERIC(10,2),
  shipping_address JSONB NOT NULL DEFAULT '{}',
  tracking_number TEXT,
  supplier_ref    TEXT,
  notes           TEXT,
  submitted_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_printing_orders_org ON printing_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_printing_orders_project ON printing_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_printing_orders_status ON printing_orders(status);
CREATE INDEX IF NOT EXISTS idx_printing_orders_pod ON printing_orders(pod_integration_id);

-- ─── Legal Requirements (per-country publishing compliance) ────────────
CREATE TABLE IF NOT EXISTS legal_requirements (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  country_code    TEXT NOT NULL,
  country_name    TEXT NOT NULL,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN (
    'isbn_registration', 'copyright_filing', 'distribution_license',
    'tax_obligation', 'content_rating', 'deposit_copy', 'import_export',
    'data_protection', 'censorship_review', 'author_contract'
  )),
  title           TEXT NOT NULL,
  description     TEXT,
  authority_name  TEXT,
  authority_url   TEXT,
  cost_eur        NUMERIC(10,2),
  processing_days INTEGER,
  mandatory       BOOLEAN NOT NULL DEFAULT true,
  documents       JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'researched' CHECK (status IN (
    'researched', 'pending', 'submitted', 'approved', 'rejected', 'expired'
  )),
  valid_until     TIMESTAMPTZ,
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_legal_req_org ON legal_requirements(org_id);
CREATE INDEX IF NOT EXISTS idx_legal_req_country ON legal_requirements(country_code);
CREATE INDEX IF NOT EXISTS idx_legal_req_type ON legal_requirements(requirement_type);

-- ─── Genre Trends (market research data) ───────────────────────────────
CREATE TABLE IF NOT EXISTS genre_trends (
  id              TEXT PRIMARY KEY,
  genre           TEXT NOT NULL,
  sub_genre       TEXT,
  trope           TEXT,
  market          TEXT NOT NULL DEFAULT 'global',
  source          TEXT NOT NULL CHECK (source IN (
    'amazon_bestseller', 'goodreads', 'booktok', 'bookstagram',
    'google_trends', 'publisher_weekly', 'manual', 'agent_research'
  )),
  popularity_score INTEGER NOT NULL DEFAULT 0 CHECK (popularity_score >= 0 AND popularity_score <= 100),
  competition_level TEXT NOT NULL DEFAULT 'medium' CHECK (competition_level IN (
    'low', 'medium', 'high', 'saturated'
  )),
  avg_price_eur   NUMERIC(10,2),
  monthly_sales   INTEGER,
  trending_up     BOOLEAN NOT NULL DEFAULT true,
  keywords        TEXT[] NOT NULL DEFAULT '{}',
  sample_titles   JSONB NOT NULL DEFAULT '[]',
  demographic     JSONB NOT NULL DEFAULT '{}',
  notes           TEXT,
  researched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_genre_trends_genre ON genre_trends(genre);
CREATE INDEX IF NOT EXISTS idx_genre_trends_market ON genre_trends(market);
CREATE INDEX IF NOT EXISTS idx_genre_trends_source ON genre_trends(source);
CREATE INDEX IF NOT EXISTS idx_genre_trends_popularity ON genre_trends(popularity_score DESC);

-- ─── Author Personas (evolved agent-author brands) ─────────────────────
CREATE TABLE IF NOT EXISTS author_personas (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  pen_name        TEXT NOT NULL,
  bio             TEXT,
  genres          TEXT[] NOT NULL DEFAULT '{}',
  voice_style     TEXT,
  writing_traits  JSONB NOT NULL DEFAULT '{}',
  backlist_count  INTEGER NOT NULL DEFAULT 0,
  total_sales     INTEGER NOT NULL DEFAULT 0,
  total_revenue   NUMERIC(12,2) NOT NULL DEFAULT 0,
  rating_avg      NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count    INTEGER NOT NULL DEFAULT 0,
  avatar_url      TEXT,
  social_links    JSONB NOT NULL DEFAULT '{}',
  active          BOOLEAN NOT NULL DEFAULT true,
  evolution_log   JSONB NOT NULL DEFAULT '[]',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_author_personas_org ON author_personas(org_id);
CREATE INDEX IF NOT EXISTS idx_author_personas_agent ON author_personas(agent_id);
CREATE INDEX IF NOT EXISTS idx_author_personas_name ON author_personas(pen_name);

-- ─── Edge Printing Specs (specialty suppliers) ─────────────────────────
CREATE TABLE IF NOT EXISTS edge_printing_specs (
  id              TEXT PRIMARY KEY,
  supplier_name   TEXT NOT NULL,
  supplier_country TEXT NOT NULL,
  edge_types      TEXT[] NOT NULL DEFAULT '{}',
  min_order_qty   INTEGER NOT NULL DEFAULT 50,
  cost_per_unit_eur NUMERIC(10,2) NOT NULL,
  turnaround_days INTEGER NOT NULL DEFAULT 14,
  quality_rating  INTEGER CHECK (quality_rating >= 0 AND quality_rating <= 100),
  contact_email   TEXT,
  contact_url     TEXT,
  supports_custom BOOLEAN NOT NULL DEFAULT false,
  sample_images   JSONB NOT NULL DEFAULT '[]',
  notes           TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_edge_specs_supplier ON edge_printing_specs(supplier_name);
CREATE INDEX IF NOT EXISTS idx_edge_specs_country ON edge_printing_specs(supplier_country);

-- ─── Printer Purchase Proposals (ROI analysis for own equipment) ───────
CREATE TABLE IF NOT EXISTS printer_purchase_proposals (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  proposed_by     TEXT NOT NULL,
  printer_model   TEXT NOT NULL,
  printer_type    TEXT NOT NULL CHECK (printer_type IN (
    'digital_press', 'offset', 'inkjet', 'laser', 'specialty'
  )),
  purchase_cost_eur NUMERIC(12,2) NOT NULL,
  monthly_maintenance_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_per_page_eur NUMERIC(10,4) NOT NULL DEFAULT 0,
  monthly_capacity INTEGER NOT NULL DEFAULT 0,
  break_even_months INTEGER,
  current_monthly_volume INTEGER NOT NULL DEFAULT 0,
  current_monthly_cost_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  projected_savings_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  roi_percentage  NUMERIC(6,2),
  status          TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed', 'under_review', 'approved', 'rejected', 'purchased'
  )),
  approval_notes  TEXT,
  shipping_address JSONB NOT NULL DEFAULT '{}',
  vendor_url      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_printer_proposals_org ON printer_purchase_proposals(org_id);
CREATE INDEX IF NOT EXISTS idx_printer_proposals_status ON printer_purchase_proposals(status);

-- ─── Extend marketplace_tasks with new publishing v2 task types ────────
ALTER TABLE marketplace_tasks
  DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;
ALTER TABLE marketplace_tasks
  ADD CONSTRAINT marketplace_tasks_task_type_check
  CHECK (task_type IN (
    'translate', 'write', 'design', 'research', 'support', 'custom',
    'review', 'proofread', 'format', 'cover_design', 'genre_research',
    'legal_research', 'print_broker', 'trend_research', 'author_persona',
    'misiuni_post', 'misiuni_verify'
  ));
