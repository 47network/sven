-- Batch 56 — Agent Marketplace Reviews
-- Customer reviews, ratings, seller responses, review moderation,
-- and review analytics for marketplace listings.

-- 1. Marketplace reviews
CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id              TEXT PRIMARY KEY,
  listing_id      TEXT NOT NULL,
  reviewer_id     TEXT NOT NULL,
  seller_id       TEXT NOT NULL,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title           TEXT,
  body            TEXT,
  pros            JSONB NOT NULL DEFAULT '[]',
  cons            JSONB NOT NULL DEFAULT '[]',
  verified        BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','flagged','hidden')),
  helpful_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Review responses
CREATE TABLE IF NOT EXISTS review_responses (
  id              TEXT PRIMARY KEY,
  review_id       TEXT NOT NULL REFERENCES marketplace_reviews(id),
  responder_id    TEXT NOT NULL,
  body            TEXT NOT NULL,
  response_type   TEXT NOT NULL DEFAULT 'seller' CHECK (response_type IN ('seller','admin','system','follow_up','clarification')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Review moderation
CREATE TABLE IF NOT EXISTS review_moderation (
  id              TEXT PRIMARY KEY,
  review_id       TEXT NOT NULL REFERENCES marketplace_reviews(id),
  moderator_id    TEXT,
  action          TEXT NOT NULL CHECK (action IN ('approve','reject','flag','hide','escalate','unflag')),
  reason          TEXT,
  automated       BOOLEAN NOT NULL DEFAULT false,
  confidence      NUMERIC(5,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Review votes
CREATE TABLE IF NOT EXISTS review_votes (
  id              TEXT PRIMARY KEY,
  review_id       TEXT NOT NULL REFERENCES marketplace_reviews(id),
  voter_id        TEXT NOT NULL,
  vote_type       TEXT NOT NULL CHECK (vote_type IN ('helpful','unhelpful','spam','inappropriate','outdated')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, voter_id)
);

-- 5. Review analytics
CREATE TABLE IF NOT EXISTS review_analytics (
  id              TEXT PRIMARY KEY,
  listing_id      TEXT NOT NULL,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  total_reviews   INTEGER NOT NULL DEFAULT 0,
  average_rating  NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_dist     JSONB NOT NULL DEFAULT '{}',
  sentiment_score NUMERIC(5,2),
  top_pros        JSONB NOT NULL DEFAULT '[]',
  top_cons        JSONB NOT NULL DEFAULT '[]',
  response_rate   NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (17)
CREATE INDEX IF NOT EXISTS idx_reviews_listing ON marketplace_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON marketplace_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON marketplace_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON marketplace_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON marketplace_reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON marketplace_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_responses_review ON review_responses(review_id);
CREATE INDEX IF NOT EXISTS idx_responses_responder ON review_responses(responder_id);
CREATE INDEX IF NOT EXISTS idx_responses_type ON review_responses(response_type);
CREATE INDEX IF NOT EXISTS idx_moderation_review ON review_moderation(review_id);
CREATE INDEX IF NOT EXISTS idx_moderation_action ON review_moderation(action);
CREATE INDEX IF NOT EXISTS idx_moderation_moderator ON review_moderation(moderator_id);
CREATE INDEX IF NOT EXISTS idx_votes_review ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON review_votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_type ON review_votes(vote_type);
CREATE INDEX IF NOT EXISTS idx_analytics_listing ON review_analytics(listing_id);
CREATE INDEX IF NOT EXISTS idx_analytics_period ON review_analytics(period_start, period_end);
