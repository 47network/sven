/**
 * Batch 26 — XLVII Brand / Merch Platform
 *
 * Validates: migration schema, shared types, skills, admin API routes,
 * NATS/Eidolon integration, and task executor handlers.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ================================================================== */
/*  Helper: read source file                                           */
/* ================================================================== */
function src(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

/* ================================================================== */
/*  1 — Migration: xlvii_merch.sql                                     */
/* ================================================================== */
describe('Batch 26 — Migration', () => {
  const sql = src('services/gateway-api/migrations/20260430120000_xlvii_merch.sql');

  describe('xlvii_collections table', () => {
    it('creates the table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS xlvii_collections');
    });
    it('has all required columns', () => {
      for (const col of ['id', 'name', 'slug', 'description', 'season', 'status',
        'launch_date', 'cover_image_url', 'theme', 'designer_agent_id', 'metadata']) {
        expect(sql).toContain(col);
      }
    });
    it('enforces season CHECK constraint', () => {
      for (const v of ['spring_summer', 'fall_winter', 'holiday', 'limited_edition', 'evergreen']) {
        expect(sql).toContain(`'${v}'`);
      }
    });
    it('creates indexes', () => {
      expect(sql).toContain('idx_xlvii_collections_status');
      expect(sql).toContain('idx_xlvii_collections_season');
      expect(sql).toContain('idx_xlvii_collections_slug');
    });
  });

  describe('xlvii_products table', () => {
    it('creates the table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS xlvii_products');
    });
    it('has all required columns', () => {
      for (const col of ['collection_id', 'name', 'slug', 'category', 'base_price',
        'currency', 'cost_price', 'quality_tier', 'pod_provider', 'design_url',
        'total_sales', 'total_revenue', 'listing_id']) {
        expect(sql).toContain(col);
      }
    });
    it('enforces category CHECK with 10 values', () => {
      for (const cat of ['tshirt', 'hoodie', 'cap', 'jacket', 'pants', 'accessory',
        'premium_embroidered', 'limited_edition', 'poster', 'sticker']) {
        expect(sql).toContain(`'${cat}'`);
      }
    });
    it('enforces quality_tier CHECK', () => {
      for (const tier of ['standard', 'premium', 'luxury', 'limited']) {
        expect(sql).toContain(`'${tier}'`);
      }
    });
    it('creates indexes', () => {
      expect(sql).toContain('idx_xlvii_products_collection');
      expect(sql).toContain('idx_xlvii_products_category');
      expect(sql).toContain('idx_xlvii_products_status');
      expect(sql).toContain('idx_xlvii_products_quality');
      expect(sql).toContain('idx_xlvii_products_pod');
    });
  });

  describe('xlvii_variants table', () => {
    it('creates the table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS xlvii_variants');
    });
    it('has size CHECK with 8 values', () => {
      for (const s of ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'one_size']) {
        expect(sql).toContain(`'${s}'`);
      }
    });
    it('has inventory_count and sku columns', () => {
      expect(sql).toContain('inventory_count');
      expect(sql).toContain('sku');
    });
    it('creates indexes', () => {
      expect(sql).toContain('idx_xlvii_variants_product');
      expect(sql).toContain('idx_xlvii_variants_sku');
      expect(sql).toContain('idx_xlvii_variants_status');
    });
  });

  describe('xlvii_designs table', () => {
    it('creates the table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS xlvii_designs');
    });
    it('has design_type CHECK with 8 values', () => {
      for (const dt of ['logo_placement', 'full_print', 'embroidery', 'minimalist',
        'typography', 'illustration', 'pattern', 'limited_art']) {
        expect(sql).toContain(`'${dt}'`);
      }
    });
    it('has placement CHECK with 7 values', () => {
      for (const p of ['front', 'back', 'sleeve_left', 'sleeve_right', 'pocket', 'all_over', 'collar']) {
        expect(sql).toContain(`'${p}'`);
      }
    });
    it('has approval_status CHECK', () => {
      for (const s of ['pending', 'approved', 'rejected', 'revision_needed']) {
        expect(sql).toContain(`'${s}'`);
      }
    });
    it('creates indexes', () => {
      expect(sql).toContain('idx_xlvii_designs_product');
      expect(sql).toContain('idx_xlvii_designs_type');
      expect(sql).toContain('idx_xlvii_designs_approval');
      expect(sql).toContain('idx_xlvii_designs_designer');
    });
  });

  describe('xlvii_fulfillments table', () => {
    it('creates the table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS xlvii_fulfillments');
    });
    it('has fulfillment_type CHECK with 7 values', () => {
      for (const ft of ['pod_printful', 'pod_printify', 'pod_gooten', 'pod_gelato',
        'custom_local', 'hand_embroidered', 'warehouse']) {
        expect(sql).toContain(`'${ft}'`);
      }
    });
    it('has status CHECK with 8 values', () => {
      for (const s of ['pending', 'processing', 'production', 'shipped',
        'delivered', 'returned', 'cancelled', 'refunded']) {
        expect(sql).toContain(`'${s}'`);
      }
    });
    it('has shipping columns', () => {
      for (const col of ['tracking_number', 'tracking_url', 'carrier',
        'ship_to_name', 'ship_to_address', 'ship_to_country']) {
        expect(sql).toContain(col);
      }
    });
    it('creates indexes', () => {
      expect(sql).toContain('idx_xlvii_fulfillments_order');
      expect(sql).toContain('idx_xlvii_fulfillments_variant');
      expect(sql).toContain('idx_xlvii_fulfillments_status');
      expect(sql).toContain('idx_xlvii_fulfillments_type');
    });
  });

  describe('marketplace_tasks ALTER', () => {
    it('drops old CHECK constraint', () => {
      expect(sql).toContain('DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check');
    });
    it('adds merch_listing to task_type CHECK', () => {
      expect(sql).toContain("'merch_listing'");
    });
    it('adds product_design to task_type CHECK', () => {
      expect(sql).toContain("'product_design'");
    });
    it('preserves all prior task types', () => {
      for (const tt of ['translate', 'write', 'review', 'proofread', 'format',
        'cover_design', 'genre_research', 'design', 'research', 'support',
        'social_post', 'social_analytics']) {
        expect(sql).toContain(`'${tt}'`);
      }
    });
  });

  it('total indexes >= 19', () => {
    const idxCount = (sql.match(/CREATE INDEX/g) || []).length;
    expect(idxCount).toBeGreaterThanOrEqual(19);
  });
});

/* ================================================================== */
/*  2 — Shared Types: xlvii-merch.ts                                   */
/* ================================================================== */
describe('Batch 26 — Shared Types', () => {
  const ts = src('packages/shared/src/xlvii-merch.ts');

  describe('type unions', () => {
    it('exports XlviiProductCategory with 10 values', () => {
      expect(ts).toContain('export type XlviiProductCategory');
      for (const v of ['tshirt', 'hoodie', 'cap', 'jacket', 'pants', 'accessory',
        'premium_embroidered', 'limited_edition', 'poster', 'sticker']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiQualityTier with 4 values', () => {
      expect(ts).toContain('export type XlviiQualityTier');
      for (const v of ['standard', 'premium', 'luxury', 'limited']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiProductStatus with 7 values', () => {
      expect(ts).toContain('export type XlviiProductStatus');
      for (const v of ['draft', 'design_review', 'sample_ordered', 'approved',
        'listed', 'paused', 'discontinued']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiPodProvider with 5 values', () => {
      expect(ts).toContain('export type XlviiPodProvider');
      for (const v of ['printful', 'printify', 'gooten', 'gelato', 'custom_local']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiSeason with 5 values', () => {
      expect(ts).toContain('export type XlviiSeason');
      for (const v of ['spring_summer', 'fall_winter', 'holiday', 'limited_edition', 'evergreen']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiCollectionStatus with 5 values', () => {
      expect(ts).toContain('export type XlviiCollectionStatus');
      for (const v of ['draft', 'preview', 'active', 'archived', 'sold_out']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiSize with 8 values', () => {
      expect(ts).toContain('export type XlviiSize');
      for (const v of ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'one_size']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiDesignType with 8 values', () => {
      expect(ts).toContain('export type XlviiDesignType');
      for (const v of ['logo_placement', 'full_print', 'embroidery', 'minimalist',
        'typography', 'illustration', 'pattern', 'limited_art']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiPlacement with 7 values', () => {
      expect(ts).toContain('export type XlviiPlacement');
      for (const v of ['front', 'back', 'sleeve_left', 'sleeve_right', 'pocket', 'all_over', 'collar']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiApprovalStatus with 4 values', () => {
      expect(ts).toContain('export type XlviiApprovalStatus');
      for (const v of ['pending', 'approved', 'rejected', 'revision_needed']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiFulfillmentType with 7 values', () => {
      expect(ts).toContain('export type XlviiFulfillmentType');
      for (const v of ['pod_printful', 'pod_printify', 'pod_gooten', 'pod_gelato',
        'custom_local', 'hand_embroidered', 'warehouse']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiFulfillmentStatus with 8 values', () => {
      expect(ts).toContain('export type XlviiFulfillmentStatus');
      for (const v of ['pending', 'processing', 'production', 'shipped',
        'delivered', 'returned', 'cancelled', 'refunded']) {
        expect(ts).toContain(`'${v}'`);
      }
    });

    it('exports XlviiVariantStatus with 4 values', () => {
      expect(ts).toContain('export type XlviiVariantStatus');
      for (const v of ['active', 'out_of_stock', 'discontinued', 'pre_order']) {
        expect(ts).toContain(`'${v}'`);
      }
    });
  });

  describe('interfaces', () => {
    it('exports XlviiCollection', () => {
      expect(ts).toContain('export interface XlviiCollection');
      expect(ts).toContain('season: XlviiSeason');
      expect(ts).toContain('coverImageUrl: string | null');
    });

    it('exports XlviiProduct', () => {
      expect(ts).toContain('export interface XlviiProduct');
      expect(ts).toContain('category: XlviiProductCategory');
      expect(ts).toContain('qualityTier: XlviiQualityTier');
      expect(ts).toContain('podProvider: XlviiPodProvider | null');
    });

    it('exports XlviiVariant', () => {
      expect(ts).toContain('export interface XlviiVariant');
      expect(ts).toContain('size: XlviiSize');
      expect(ts).toContain('inventoryCount: number');
    });

    it('exports XlviiDesign', () => {
      expect(ts).toContain('export interface XlviiDesign');
      expect(ts).toContain('designType: XlviiDesignType');
      expect(ts).toContain('placement: XlviiPlacement');
      expect(ts).toContain('approvalStatus: XlviiApprovalStatus');
    });

    it('exports XlviiFulfillment', () => {
      expect(ts).toContain('export interface XlviiFulfillment');
      expect(ts).toContain('fulfillmentType: XlviiFulfillmentType');
      expect(ts).toContain('trackingNumber: string | null');
      expect(ts).toContain('shipToCountry: string');
    });
  });

  describe('constants', () => {
    it('exports XLVII_CATEGORIES with 10 entries', () => {
      expect(ts).toContain('export const XLVII_CATEGORIES');
      expect(ts).toContain("'tshirt'");
      expect(ts).toContain("'sticker'");
    });

    it('exports XLVII_SIZES with 8 entries', () => {
      expect(ts).toContain('export const XLVII_SIZES');
      expect(ts).toContain("'one_size'");
    });

    it('exports XLVII_BRAND_THEME', () => {
      expect(ts).toContain('export const XLVII_BRAND_THEME');
      expect(ts).toContain("name: 'XLVII'");
      expect(ts).toContain("element: 'Ag (Argentum)'");
      expect(ts).toContain('atomicNumber: 47');
      expect(ts).toContain("primaryColor: '#C0C0C0'");
    });

    it('exports XLVII_POD_PROVIDERS', () => {
      expect(ts).toContain('export const XLVII_POD_PROVIDERS');
    });

    it('exports XLVII_PRODUCT_STATUS_ORDER', () => {
      expect(ts).toContain('export const XLVII_PRODUCT_STATUS_ORDER');
    });

    it('exports XLVII_BASE_PRICES with prices for all categories', () => {
      expect(ts).toContain('export const XLVII_BASE_PRICES');
      expect(ts).toContain('tshirt: 29.99');
      expect(ts).toContain('hoodie: 59.99');
    });

    it('exports XLVII_QUALITY_MULTIPLIERS', () => {
      expect(ts).toContain('export const XLVII_QUALITY_MULTIPLIERS');
      expect(ts).toContain('standard: 1.0');
      expect(ts).toContain('premium: 1.5');
      expect(ts).toContain('luxury: 2.5');
      expect(ts).toContain('limited: 3.0');
    });
  });

  describe('utility functions', () => {
    it('exports calculateProductPrice', () => {
      expect(ts).toContain('export function calculateProductPrice');
    });
    it('exports calculateMargin', () => {
      expect(ts).toContain('export function calculateMargin');
    });
    it('exports generateSku', () => {
      expect(ts).toContain('export function generateSku');
      expect(ts).toContain('XLVII-');
    });
    it('exports canAdvanceProduct', () => {
      expect(ts).toContain('export function canAdvanceProduct');
    });
    it('exports isLowStock', () => {
      expect(ts).toContain('export function isLowStock');
    });
    it('exports isOutOfStock', () => {
      expect(ts).toContain('export function isOutOfStock');
    });
  });

  it('is exported from shared index', () => {
    const idx = src('packages/shared/src/index.ts');
    expect(idx).toContain("from './xlvii-merch.js'");
  });
});

/* ================================================================== */
/*  3 — Skills: xlvii-catalog & xlvii-design                           */
/* ================================================================== */
describe('Batch 26 — Skills', () => {
  describe('xlvii-catalog SKILL.md', () => {
    const skill = src('skills/autonomous-economy/xlvii-catalog/SKILL.md');

    it('has YAML frontmatter with required fields', () => {
      expect(skill).toContain('name: xlvii-catalog');
      expect(skill).toContain('archetype: seller');
      expect(skill).toContain('price: 2.99');
    });

    it('defines 4 actions', () => {
      expect(skill).toContain('create-collection');
      expect(skill).toContain('add-product');
      expect(skill).toContain('manage-variants');
      expect(skill).toContain('check-inventory');
    });

    it('includes brand references', () => {
      expect(skill).toContain('XLVII');
      expect(skill).toContain('Element 47');
    });

    it('mentions NATS integration', () => {
      expect(skill).toContain('sven.xlvii.collection_created');
      expect(skill).toContain('sven.xlvii.product_created');
    });
  });

  describe('xlvii-design SKILL.md', () => {
    const skill = src('skills/autonomous-economy/xlvii-design/SKILL.md');

    it('has YAML frontmatter with required fields', () => {
      expect(skill).toContain('name: xlvii-design');
      expect(skill).toContain('archetype: designer');
      expect(skill).toContain('price: 4.99');
    });

    it('defines 4 actions', () => {
      expect(skill).toContain('generate-brief');
      expect(skill).toContain('generate-prompt');
      expect(skill).toContain('submit-for-approval');
      expect(skill).toContain('prepare-print-assets');
    });

    it('includes colour palette and brand guidelines', () => {
      expect(skill).toContain('#C0C0C0');
      expect(skill).toContain('#0A1628');
      expect(skill).toContain('#00D4FF');
    });

    it('mentions design workflow', () => {
      expect(skill).toContain('Brief');
      expect(skill).toContain('Prompt');
      expect(skill).toContain('Review');
      expect(skill).toContain('Assets');
    });

    it('mentions NATS events', () => {
      expect(skill).toContain('sven.xlvii.design_created');
      expect(skill).toContain('sven.xlvii.design_approved');
    });
  });
});

/* ================================================================== */
/*  4 — Admin API Routes                                               */
/* ================================================================== */
describe('Batch 26 — Admin API Routes', () => {
  const api = src('services/gateway-api/src/routes/admin/xlvii-merch.ts');

  it('exports registerXlviiRoutes', () => {
    expect(api).toContain('export function registerXlviiRoutes');
  });

  it('accepts FastifyInstance, Pool, optional NatsConnection', () => {
    expect(api).toContain('app: FastifyInstance');
    expect(api).toContain('pool: Pool');
    expect(api).toContain('nc?: NatsConnection');
  });

  it('has publishNats helper', () => {
    expect(api).toContain('function publishNats');
  });

  it('has genId helper', () => {
    expect(api).toContain('function genId');
  });

  describe('collections CRUD', () => {
    it('GET /v1/admin/xlvii/collections', () => {
      expect(api).toContain("app.get('/v1/admin/xlvii/collections'");
    });
    it('POST /v1/admin/xlvii/collections', () => {
      expect(api).toContain("app.post('/v1/admin/xlvii/collections'");
    });
    it('GET /v1/admin/xlvii/collections/:collectionId', () => {
      expect(api).toContain("app.get('/v1/admin/xlvii/collections/:collectionId'");
    });
    it('PATCH /v1/admin/xlvii/collections/:collectionId', () => {
      expect(api).toContain("app.patch('/v1/admin/xlvii/collections/:collectionId'");
    });
    it('DELETE /v1/admin/xlvii/collections/:collectionId', () => {
      expect(api).toContain("app.delete('/v1/admin/xlvii/collections/:collectionId'");
    });
  });

  describe('products CRUD', () => {
    it('GET /v1/admin/xlvii/products', () => {
      expect(api).toContain("app.get('/v1/admin/xlvii/products'");
    });
    it('POST /v1/admin/xlvii/products', () => {
      expect(api).toContain("app.post('/v1/admin/xlvii/products'");
    });
    it('GET /v1/admin/xlvii/products/:productId', () => {
      expect(api).toContain("app.get('/v1/admin/xlvii/products/:productId'");
    });
    it('PATCH /v1/admin/xlvii/products/:productId', () => {
      expect(api).toContain("app.patch('/v1/admin/xlvii/products/:productId'");
    });
  });

  describe('variants', () => {
    it('POST /v1/admin/xlvii/products/:productId/variants', () => {
      expect(api).toContain("'/v1/admin/xlvii/products/:productId/variants'");
    });
  });

  describe('designs', () => {
    it('POST /v1/admin/xlvii/designs', () => {
      expect(api).toContain("app.post('/v1/admin/xlvii/designs'");
    });
    it('GET /v1/admin/xlvii/designs', () => {
      expect(api).toContain("app.get('/v1/admin/xlvii/designs'");
    });
  });

  describe('fulfillments', () => {
    it('POST /v1/admin/xlvii/fulfillments', () => {
      expect(api).toContain("app.post('/v1/admin/xlvii/fulfillments'");
    });
    it('PATCH for fulfillment shipping', () => {
      expect(api).toContain("'/v1/admin/xlvii/fulfillments/:fulfillmentId/ship'");
    });
  });

  describe('admin wiring', () => {
    const adminIndex = src('services/gateway-api/src/routes/admin/index.ts');

    it('imports registerXlviiRoutes', () => {
      expect(adminIndex).toContain("import { registerXlviiRoutes } from './xlvii-merch.js'");
    });
    it('mounts registerXlviiRoutes', () => {
      expect(adminIndex).toContain('registerXlviiRoutes(scopedApp, pool, nc)');
    });
  });
});

/* ================================================================== */
/*  5 — NATS / Eidolon Integration                                     */
/* ================================================================== */
describe('Batch 26 — NATS / Eidolon', () => {
  describe('SUBJECT_MAP entries', () => {
    const bus = src('services/sven-eidolon/src/event-bus.ts');

    it('maps sven.xlvii.collection_created', () => {
      expect(bus).toContain("'sven.xlvii.collection_created': 'xlvii.collection_created'");
    });
    it('maps sven.xlvii.product_created', () => {
      expect(bus).toContain("'sven.xlvii.product_created': 'xlvii.product_created'");
    });
    it('maps sven.xlvii.design_created', () => {
      expect(bus).toContain("'sven.xlvii.design_created': 'xlvii.design_created'");
    });
    it('maps sven.xlvii.design_approved', () => {
      expect(bus).toContain("'sven.xlvii.design_approved': 'xlvii.design_approved'");
    });
    it('maps sven.xlvii.fulfillment_shipped', () => {
      expect(bus).toContain("'sven.xlvii.fulfillment_shipped': 'xlvii.fulfillment_shipped'");
    });
  });

  describe('EidolonBuildingKind', () => {
    const types = src('services/sven-eidolon/src/types.ts');

    it('includes xlvii_storefront', () => {
      expect(types).toContain("'xlvii_storefront'");
    });
    it('has >= 11 building kinds', () => {
      const pipeCount = (types.match(/EidolonBuildingKind[\s\S]*?;/)?.[0]?.match(/\|/g) || []).length;
      expect(pipeCount).toBeGreaterThanOrEqual(10);
    });
  });

  describe('EidolonEventKind', () => {
    const types = src('services/sven-eidolon/src/types.ts');

    it('includes 5 xlvii events', () => {
      expect(types).toContain("'xlvii.collection_created'");
      expect(types).toContain("'xlvii.product_created'");
      expect(types).toContain("'xlvii.design_created'");
      expect(types).toContain("'xlvii.design_approved'");
      expect(types).toContain("'xlvii.fulfillment_shipped'");
    });
  });

  describe('districtFor', () => {
    const types = src('services/sven-eidolon/src/types.ts');

    it('maps xlvii_storefront to market district', () => {
      expect(types).toContain("case 'xlvii_storefront':");
      expect(types).toContain("return 'market'");
    });
  });
});

/* ================================================================== */
/*  6 — Task Executor                                                  */
/* ================================================================== */
describe('Batch 26 — Task Executor', () => {
  const tex = src('services/sven-marketplace/src/task-executor.ts');

  describe('routeToHandler cases', () => {
    it('has merch_listing case', () => {
      expect(tex).toContain("case 'merch_listing':");
    });
    it('has product_design case', () => {
      expect(tex).toContain("case 'product_design':");
    });
    it('routes merch_listing to handleMerchListing', () => {
      expect(tex).toContain('this.handleMerchListing(input)');
    });
    it('routes product_design to handleProductDesign', () => {
      expect(tex).toContain('this.handleProductDesign(input)');
    });
  });

  describe('handleMerchListing', () => {
    it('defines the handler method', () => {
      expect(tex).toContain('handleMerchListing');
    });
    it('generates XLVII SKU', () => {
      expect(tex).toContain('XLVII-');
    });
    it('uses quality multipliers', () => {
      expect(tex).toContain('qualityMultipliers');
    });
    it('calculates final price', () => {
      expect(tex).toContain('finalPrice');
    });
    it('returns listing with sizes', () => {
      expect(tex).toContain("'S', 'M', 'L', 'XL'");
    });
  });

  describe('handleProductDesign', () => {
    it('defines the handler method', () => {
      expect(tex).toContain('handleProductDesign');
    });
    it('includes style keywords', () => {
      expect(tex).toContain('styleKeywords');
      expect(tex).toContain('neon accents');
      expect(tex).toContain('geometric patterns');
    });
    it('generates AI prompt', () => {
      expect(tex).toContain('aiPrompt');
    });
    it('includes brand elements', () => {
      expect(tex).toContain('XLVII logo');
      expect(tex).toContain('Element 47 motif');
    });
    it('includes print spec', () => {
      expect(tex).toContain('printSpec');
      expect(tex).toContain('dpi: 300');
      expect(tex).toContain('CMYK');
    });
  });
});

/* ================================================================== */
/*  7 — Skill directory count                                          */
/* ================================================================== */
describe('Batch 26 — Skill Directory Count', () => {
  it('has >= 22 skills in autonomous-economy', () => {
    const dir = path.join(ROOT, 'skills', 'autonomous-economy');
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const skillDirs = entries.filter(e => e.isDirectory()).length;
    expect(skillDirs).toBeGreaterThanOrEqual(22);
  });
});
