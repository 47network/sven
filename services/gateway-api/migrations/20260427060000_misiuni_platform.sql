-- ---------------------------------------------------------------------------
-- Batch 23 — Misiuni.ro Platform (AI Hires Humans)
-- ---------------------------------------------------------------------------
-- Romanian RentAHuman-style service: Sven's AI agents post real-world tasks
-- ("misiuni") for human workers. Supports B2B bulk posting, escrow payments,
-- proof-of-work verification, two-way ratings, and dispute resolution.
-- Domains: misiuni.ro, misiuni.from.sven.systems
-- ---------------------------------------------------------------------------

-- 1) Workers — human workers who sign up to perform physical tasks
CREATE TABLE IF NOT EXISTS misiuni_workers (
  id               TEXT PRIMARY KEY,
  org_id           TEXT NOT NULL,
  display_name     TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  location_city    TEXT,
  location_county  TEXT,
  location_lat     DOUBLE PRECISION,
  location_lng     DOUBLE PRECISION,
  skills           TEXT[] NOT NULL DEFAULT '{}',
  hourly_rate_eur  NUMERIC(10, 2),
  availability     TEXT NOT NULL DEFAULT 'available' CHECK (availability IN (
    'available', 'busy', 'offline', 'suspended'
  )),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'verified', 'active', 'suspended', 'banned'
  )),
  rating_avg       NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
  rating_count     INTEGER NOT NULL DEFAULT 0,
  tasks_completed  INTEGER NOT NULL DEFAULT 0,
  kyc_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_data         JSONB NOT NULL DEFAULT '{}',
  profile_image    TEXT,
  bio              TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mis_workers_org      ON misiuni_workers(org_id);
CREATE INDEX IF NOT EXISTS idx_mis_workers_status   ON misiuni_workers(status);
CREATE INDEX IF NOT EXISTS idx_mis_workers_city     ON misiuni_workers(location_city);
CREATE INDEX IF NOT EXISTS idx_mis_workers_county   ON misiuni_workers(location_county);
CREATE INDEX IF NOT EXISTS idx_mis_workers_email    ON misiuni_workers(email);

-- 2) Tasks — missions posted by AI agents or businesses
CREATE TABLE IF NOT EXISTS misiuni_tasks (
  id                TEXT PRIMARY KEY,
  org_id            TEXT NOT NULL,
  poster_agent_id   TEXT,
  poster_business   TEXT,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN (
    'photography', 'delivery', 'verification', 'inspection',
    'data_collection', 'event_attendance', 'purchase', 'survey',
    'maintenance', 'testing', 'mystery_shopping', 'other'
  )),
  location_city     TEXT,
  location_county   TEXT,
  location_lat      DOUBLE PRECISION,
  location_lng      DOUBLE PRECISION,
  location_address  TEXT,
  location_radius_km NUMERIC(6, 2),
  budget_eur        NUMERIC(10, 2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'EUR',
  deadline          TIMESTAMPTZ,
  required_proof    TEXT NOT NULL DEFAULT 'photo' CHECK (required_proof IN (
    'photo', 'video', 'gps_checkin', 'receipt', 'document', 'signature', 'multiple'
  )),
  proof_instructions TEXT,
  max_workers       INTEGER NOT NULL DEFAULT 1,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'open', 'assigned', 'in_progress', 'proof_submitted',
    'verified', 'completed', 'cancelled', 'disputed', 'expired'
  )),
  priority          TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'low', 'normal', 'high', 'urgent'
  )),
  required_skills   TEXT[] NOT NULL DEFAULT '{}',
  tags              TEXT[] NOT NULL DEFAULT '{}',
  escrow_ref        TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mis_tasks_org        ON misiuni_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_mis_tasks_poster     ON misiuni_tasks(poster_agent_id);
CREATE INDEX IF NOT EXISTS idx_mis_tasks_status     ON misiuni_tasks(status);
CREATE INDEX IF NOT EXISTS idx_mis_tasks_category   ON misiuni_tasks(category);
CREATE INDEX IF NOT EXISTS idx_mis_tasks_city       ON misiuni_tasks(location_city);
CREATE INDEX IF NOT EXISTS idx_mis_tasks_deadline   ON misiuni_tasks(deadline);

-- 3) Bids — workers bid on tasks
CREATE TABLE IF NOT EXISTS misiuni_bids (
  id             TEXT PRIMARY KEY,
  task_id        TEXT NOT NULL REFERENCES misiuni_tasks(id),
  worker_id      TEXT NOT NULL REFERENCES misiuni_workers(id),
  amount_eur     NUMERIC(10, 2) NOT NULL,
  message        TEXT,
  estimated_hours NUMERIC(5, 2),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'rejected', 'withdrawn', 'expired'
  )),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mis_bids_task   ON misiuni_bids(task_id);
CREATE INDEX IF NOT EXISTS idx_mis_bids_worker ON misiuni_bids(worker_id);
CREATE INDEX IF NOT EXISTS idx_mis_bids_status ON misiuni_bids(status);

-- 4) Proofs — evidence submitted by workers (photos, GPS, receipts)
CREATE TABLE IF NOT EXISTS misiuni_proofs (
  id             TEXT PRIMARY KEY,
  task_id        TEXT NOT NULL REFERENCES misiuni_tasks(id),
  worker_id      TEXT NOT NULL REFERENCES misiuni_workers(id),
  proof_type     TEXT NOT NULL CHECK (proof_type IN (
    'photo', 'video', 'gps_checkin', 'receipt', 'document', 'signature'
  )),
  file_url       TEXT,
  gps_lat        DOUBLE PRECISION,
  gps_lng        DOUBLE PRECISION,
  gps_accuracy_m NUMERIC(8, 2),
  description    TEXT,
  ai_verified    BOOLEAN,
  ai_confidence  NUMERIC(5, 4),
  human_verified BOOLEAN,
  verified_by    TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'ai_reviewing', 'verified', 'rejected', 'needs_review'
  )),
  metadata       JSONB NOT NULL DEFAULT '{}',
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mis_proofs_task   ON misiuni_proofs(task_id);
CREATE INDEX IF NOT EXISTS idx_mis_proofs_worker ON misiuni_proofs(worker_id);
CREATE INDEX IF NOT EXISTS idx_mis_proofs_status ON misiuni_proofs(status);

-- 5) Payments — escrow, release, refund tracking
CREATE TABLE IF NOT EXISTS misiuni_payments (
  id             TEXT PRIMARY KEY,
  task_id        TEXT NOT NULL REFERENCES misiuni_tasks(id),
  worker_id      TEXT REFERENCES misiuni_workers(id),
  amount_eur     NUMERIC(10, 2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'EUR',
  payment_type   TEXT NOT NULL CHECK (payment_type IN (
    'escrow_hold', 'escrow_release', 'refund', 'bonus', 'platform_fee'
  )),
  payment_method TEXT NOT NULL DEFAULT 'stripe' CHECK (payment_method IN (
    'stripe', 'crypto_base', 'internal_credit', 'bank_transfer'
  )),
  stripe_ref     TEXT,
  treasury_ref   TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mis_payments_task   ON misiuni_payments(task_id);
CREATE INDEX IF NOT EXISTS idx_mis_payments_worker ON misiuni_payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_mis_payments_status ON misiuni_payments(status);
CREATE INDEX IF NOT EXISTS idx_mis_payments_type   ON misiuni_payments(payment_type);

-- 6) Reviews — two-way ratings (agent→worker and worker→agent)
CREATE TABLE IF NOT EXISTS misiuni_reviews (
  id             TEXT PRIMARY KEY,
  task_id        TEXT NOT NULL REFERENCES misiuni_tasks(id),
  reviewer_type  TEXT NOT NULL CHECK (reviewer_type IN ('agent', 'worker', 'business')),
  reviewer_id    TEXT NOT NULL,
  reviewee_type  TEXT NOT NULL CHECK (reviewee_type IN ('agent', 'worker', 'business')),
  reviewee_id    TEXT NOT NULL,
  rating         INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment        TEXT,
  tags           TEXT[] NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mis_reviews_task     ON misiuni_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_mis_reviews_reviewer ON misiuni_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_mis_reviews_reviewee ON misiuni_reviews(reviewee_id);

-- 7) Disputes — conflict resolution between parties
CREATE TABLE IF NOT EXISTS misiuni_disputes (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL REFERENCES misiuni_tasks(id),
  filed_by_type   TEXT NOT NULL CHECK (filed_by_type IN ('agent', 'worker', 'business')),
  filed_by_id     TEXT NOT NULL,
  reason          TEXT NOT NULL CHECK (reason IN (
    'proof_rejected', 'payment_issue', 'task_not_completed',
    'safety_concern', 'quality_issue', 'fraud', 'other'
  )),
  description     TEXT NOT NULL,
  evidence_urls   TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'investigating', 'resolved_worker', 'resolved_poster',
    'escalated', 'closed'
  )),
  resolution      TEXT,
  resolved_by     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mis_disputes_task   ON misiuni_disputes(task_id);
CREATE INDEX IF NOT EXISTS idx_mis_disputes_status ON misiuni_disputes(status);
CREATE INDEX IF NOT EXISTS idx_mis_disputes_filer  ON misiuni_disputes(filed_by_id);
