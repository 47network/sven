-- Batch 26 — XLVII Brand / Merch Platform
-- Tables for premium apparel brand with POD integration

BEGIN;

-- ─── XLVII Product Collections ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xlvii_collections (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT NOT NULL DEFAULT '',
  season          TEXT NOT NULL CHECK (season IN (
    'spring_summer', 'fall_winter', 'holiday', 'limited_edition', 'evergreen'
  )),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'preview', 'active', 'archived', 'sold_out'
  )),
  launch_date     TIMESTAMPTZ,
  cover_image_url TEXT,
  theme           TEXT NOT NULL DEFAULT '',
  designer_agent_id TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xlvii_collections_status ON xlvii_collections(status);
CREATE INDEX idx_xlvii_collections_season ON xlvii_collections(season);
CREATE INDEX idx_xlvii_collections_slug ON xlvii_collections(slug);

-- ─── XLVII Products ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xlvii_products (
  id              TEXT PRIMARY KEY,
  collection_id   TEXT REFERENCES xlvii_collections(id),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL CHECK (category IN (
    'tshirt', 'hoodie', 'cap', 'jacket', 'pants', 'accessory',
    'premium_embroidered', 'limited_edition', 'poster', 'sticker'
  )),
  base_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  cost_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
  quality_tier    TEXT NOT NULL DEFAULT 'standard' CHECK (quality_tier IN (
    'standard', 'premium', 'luxury', 'limited'
  )),
  pod_provider    TEXT CHECK (pod_provider IN (
    'printful', 'printify', 'gooten', 'gelato', 'custom_local'
  )),
  pod_product_id  TEXT,
  design_url      TEXT,
  mockup_urls     JSONB NOT NULL DEFAULT '[]',
  tags            JSONB NOT NULL DEFAULT '[]',
  materials       TEXT NOT NULL DEFAULT '',
  care_instructions TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'design_review', 'sample_ordered', 'approved', 'listed', 'paused', 'discontinued'
  )),
  total_sales     INTEGER NOT NULL DEFAULT 0,
  total_revenue   NUMERIC(18,6) NOT NULL DEFAULT 0,
  listing_id      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(collection_id, slug)
);

CREATE INDEX idx_xlvii_products_collection ON xlvii_products(collection_id);
CREATE INDEX idx_xlvii_products_category ON xlvii_products(category);
CREATE INDEX idx_xlvii_products_status ON xlvii_products(status);
CREATE INDEX idx_xlvii_products_quality ON xlvii_products(quality_tier);
CREATE INDEX idx_xlvii_products_pod ON xlvii_products(pod_provider);

-- ─── XLVII Product Variants (size + color combos) ───────────────────────────

CREATE TABLE IF NOT EXISTS xlvii_variants (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES xlvii_products(id),
  sku             TEXT NOT NULL UNIQUE,
  size            TEXT NOT NULL CHECK (size IN (
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'one_size'
  )),
  color           TEXT NOT NULL,
  color_hex       TEXT NOT NULL DEFAULT '#000000',
  price_override  NUMERIC(10,2),
  inventory_count INTEGER NOT NULL DEFAULT 0,
  pod_variant_id  TEXT,
  weight_grams    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'out_of_stock', 'discontinued', 'pre_order'
  )),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xlvii_variants_product ON xlvii_variants(product_id);
CREATE INDEX idx_xlvii_variants_sku ON xlvii_variants(sku);
CREATE INDEX idx_xlvii_variants_status ON xlvii_variants(status);

-- ─── XLVII Designs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xlvii_designs (
  id              TEXT PRIMARY KEY,
  product_id      TEXT REFERENCES xlvii_products(id),
  designer_agent_id TEXT,
  name            TEXT NOT NULL,
  design_type     TEXT NOT NULL CHECK (design_type IN (
    'logo_placement', 'full_print', 'embroidery', 'minimalist',
    'typography', 'illustration', 'pattern', 'limited_art'
  )),
  design_url      TEXT NOT NULL,
  source_prompt   TEXT NOT NULL DEFAULT '',
  color_palette   JSONB NOT NULL DEFAULT '[]',
  placement       TEXT NOT NULL DEFAULT 'front' CHECK (placement IN (
    'front', 'back', 'sleeve_left', 'sleeve_right', 'pocket', 'all_over', 'collar'
  )),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN (
    'pending', 'approved', 'rejected', 'revision_needed'
  )),
  revision_notes  TEXT NOT NULL DEFAULT '',
  version         INTEGER NOT NULL DEFAULT 1,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xlvii_designs_product ON xlvii_designs(product_id);
CREATE INDEX idx_xlvii_designs_type ON xlvii_designs(design_type);
CREATE INDEX idx_xlvii_designs_approval ON xlvii_designs(approval_status);
CREATE INDEX idx_xlvii_designs_designer ON xlvii_designs(designer_agent_id);

-- ─── XLVII Fulfillments ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xlvii_fulfillments (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL,
  variant_id      TEXT NOT NULL REFERENCES xlvii_variants(id),
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN (
    'pod_printful', 'pod_printify', 'pod_gooten', 'pod_gelato',
    'custom_local', 'hand_embroidered', 'warehouse'
  )),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'production', 'shipped', 'delivered',
    'returned', 'cancelled', 'refunded'
  )),
  tracking_number TEXT,
  tracking_url    TEXT,
  carrier         TEXT,
  ship_to_name    TEXT NOT NULL DEFAULT '',
  ship_to_address JSONB NOT NULL DEFAULT '{}',
  ship_to_country TEXT NOT NULL DEFAULT 'RO',
  cost_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_currency   TEXT NOT NULL DEFAULT 'EUR',
  pod_order_id    TEXT,
  estimated_delivery TIMESTAMPTZ,
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xlvii_fulfillments_order ON xlvii_fulfillments(order_id);
CREATE INDEX idx_xlvii_fulfillments_variant ON xlvii_fulfillments(variant_id);
CREATE INDEX idx_xlvii_fulfillments_status ON xlvii_fulfillments(status);
CREATE INDEX idx_xlvii_fulfillments_type ON xlvii_fulfillments(fulfillment_type);

-- ─── ALTER marketplace_tasks ────────────────────────────────────────────────

ALTER TABLE marketplace_tasks
  DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;

ALTER TABLE marketplace_tasks
  ADD CONSTRAINT marketplace_tasks_task_type_check CHECK (task_type IN (
    'translate', 'write', 'review', 'proofread', 'format',
    'cover_design', 'genre_research', 'design', 'research', 'support',
    'misiuni_post', 'misiuni_verify',
    'legal_research', 'print_broker', 'trend_research', 'author_persona',
    'social_post', 'social_analytics',
    'merch_listing', 'product_design'
  ));

COMMIT;
