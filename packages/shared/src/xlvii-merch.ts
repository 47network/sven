// ---------------------------------------------------------------------------
// Batch 26 — XLVII Brand / Merch Platform — Shared Types
// ---------------------------------------------------------------------------

/* ── Product Category ──────────────────────────────────────────────────── */

export type XlviiProductCategory =
  | 'tshirt'
  | 'hoodie'
  | 'cap'
  | 'jacket'
  | 'pants'
  | 'accessory'
  | 'premium_embroidered'
  | 'limited_edition'
  | 'poster'
  | 'sticker';

/* ── Quality Tier ──────────────────────────────────────────────────────── */

export type XlviiQualityTier = 'standard' | 'premium' | 'luxury' | 'limited';

/* ── Product Status ────────────────────────────────────────────────────── */

export type XlviiProductStatus =
  | 'draft'
  | 'design_review'
  | 'sample_ordered'
  | 'approved'
  | 'listed'
  | 'paused'
  | 'discontinued';

/* ── POD Provider ──────────────────────────────────────────────────────── */

export type XlviiPodProvider =
  | 'printful'
  | 'printify'
  | 'gooten'
  | 'gelato'
  | 'custom_local';

/* ── Collection Season ─────────────────────────────────────────────────── */

export type XlviiSeason =
  | 'spring_summer'
  | 'fall_winter'
  | 'holiday'
  | 'limited_edition'
  | 'evergreen';

/* ── Collection Status ─────────────────────────────────────────────────── */

export type XlviiCollectionStatus =
  | 'draft'
  | 'preview'
  | 'active'
  | 'archived'
  | 'sold_out';

/* ── Variant Size ──────────────────────────────────────────────────────── */

export type XlviiSize =
  | 'XS'
  | 'S'
  | 'M'
  | 'L'
  | 'XL'
  | 'XXL'
  | 'XXXL'
  | 'one_size';

/* ── Design Type ───────────────────────────────────────────────────────── */

export type XlviiDesignType =
  | 'logo_placement'
  | 'full_print'
  | 'embroidery'
  | 'minimalist'
  | 'typography'
  | 'illustration'
  | 'pattern'
  | 'limited_art';

/* ── Design Placement ──────────────────────────────────────────────────── */

export type XlviiPlacement =
  | 'front'
  | 'back'
  | 'sleeve_left'
  | 'sleeve_right'
  | 'pocket'
  | 'all_over'
  | 'collar';

/* ── Design Approval Status ────────────────────────────────────────────── */

export type XlviiApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'revision_needed';

/* ── Fulfillment Type ──────────────────────────────────────────────────── */

export type XlviiFulfillmentType =
  | 'pod_printful'
  | 'pod_printify'
  | 'pod_gooten'
  | 'pod_gelato'
  | 'custom_local'
  | 'hand_embroidered'
  | 'warehouse';

/* ── Fulfillment Status ────────────────────────────────────────────────── */

export type XlviiFulfillmentStatus =
  | 'pending'
  | 'processing'
  | 'production'
  | 'shipped'
  | 'delivered'
  | 'returned'
  | 'cancelled'
  | 'refunded';

/* ── Variant Status ────────────────────────────────────────────────────── */

export type XlviiVariantStatus =
  | 'active'
  | 'out_of_stock'
  | 'discontinued'
  | 'pre_order';

/* ── Interfaces ────────────────────────────────────────────────────────── */

export interface XlviiCollection {
  id: string;
  name: string;
  slug: string;
  description: string;
  season: XlviiSeason;
  status: XlviiCollectionStatus;
  launchDate: string | null;
  coverImageUrl: string | null;
  theme: string;
  designerAgentId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface XlviiProduct {
  id: string;
  collectionId: string | null;
  name: string;
  slug: string;
  description: string;
  category: XlviiProductCategory;
  basePrice: number;
  currency: string;
  costPrice: number;
  qualityTier: XlviiQualityTier;
  podProvider: XlviiPodProvider | null;
  podProductId: string | null;
  designUrl: string | null;
  mockupUrls: string[];
  tags: string[];
  materials: string;
  careInstructions: string;
  status: XlviiProductStatus;
  totalSales: number;
  totalRevenue: number;
  listingId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface XlviiVariant {
  id: string;
  productId: string;
  sku: string;
  size: XlviiSize;
  color: string;
  colorHex: string;
  priceOverride: number | null;
  inventoryCount: number;
  podVariantId: string | null;
  weightGrams: number;
  status: XlviiVariantStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface XlviiDesign {
  id: string;
  productId: string | null;
  designerAgentId: string | null;
  name: string;
  designType: XlviiDesignType;
  designUrl: string;
  sourcePrompt: string;
  colorPalette: string[];
  placement: XlviiPlacement;
  approvalStatus: XlviiApprovalStatus;
  revisionNotes: string;
  version: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface XlviiFulfillment {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  fulfillmentType: XlviiFulfillmentType;
  status: XlviiFulfillmentStatus;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  shipToName: string;
  shipToAddress: Record<string, unknown>;
  shipToCountry: string;
  costAmount: number;
  costCurrency: string;
  podOrderId: string | null;
  estimatedDelivery: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/* ── Constants ─────────────────────────────────────────────────────────── */

export const XLVII_CATEGORIES: readonly XlviiProductCategory[] = [
  'tshirt', 'hoodie', 'cap', 'jacket', 'pants', 'accessory',
  'premium_embroidered', 'limited_edition', 'poster', 'sticker',
] as const;

export const XLVII_SIZES: readonly XlviiSize[] = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'one_size',
] as const;

export const XLVII_BRAND_THEME = {
  name: 'XLVII',
  tagline: 'Element 47 — Silver Standard',
  element: 'Ag (Argentum)',
  atomicNumber: 47,
  primaryColor: '#C0C0C0',
  secondaryColor: '#1A1A2E',
  accentColor: '#E94560',
  aesthetic: 'futuristic minimalist',
  fonts: { heading: 'Space Grotesk', body: 'Inter' },
} as const;

export const XLVII_POD_PROVIDERS: readonly XlviiPodProvider[] = [
  'printful', 'printify', 'gooten', 'gelato', 'custom_local',
] as const;

export const XLVII_PRODUCT_STATUS_ORDER: readonly XlviiProductStatus[] = [
  'draft', 'design_review', 'sample_ordered', 'approved', 'listed', 'paused', 'discontinued',
] as const;

export const XLVII_BASE_PRICES: Record<XlviiProductCategory, number> = {
  tshirt: 29.99,
  hoodie: 59.99,
  cap: 24.99,
  jacket: 89.99,
  pants: 49.99,
  accessory: 14.99,
  premium_embroidered: 79.99,
  limited_edition: 99.99,
  poster: 19.99,
  sticker: 4.99,
};

export const XLVII_QUALITY_MULTIPLIERS: Record<XlviiQualityTier, number> = {
  standard: 1.0,
  premium: 1.5,
  luxury: 2.5,
  limited: 3.0,
};

/* ── Utility Functions ─────────────────────────────────────────────────── */

export function calculateProductPrice(
  category: XlviiProductCategory,
  qualityTier: XlviiQualityTier,
): number {
  const base = XLVII_BASE_PRICES[category] ?? 29.99;
  const multiplier = XLVII_QUALITY_MULTIPLIERS[qualityTier] ?? 1.0;
  return Math.round(base * multiplier * 100) / 100;
}

export function calculateMargin(price: number, cost: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 10000) / 100;
}

export function generateSku(
  category: XlviiProductCategory,
  size: XlviiSize,
  color: string,
  sequence: number,
): string {
  const catCode = category.slice(0, 3).toUpperCase();
  const sizeCode = size === 'one_size' ? 'OS' : size;
  const colorCode = color.slice(0, 3).toUpperCase();
  const seq = String(sequence).padStart(4, '0');
  return `XLVII-${catCode}-${sizeCode}-${colorCode}-${seq}`;
}

export function canAdvanceProduct(
  current: XlviiProductStatus,
  next: XlviiProductStatus,
): boolean {
  const currentIdx = XLVII_PRODUCT_STATUS_ORDER.indexOf(current);
  const nextIdx = XLVII_PRODUCT_STATUS_ORDER.indexOf(next);
  if (currentIdx < 0 || nextIdx < 0) return false;
  if (next === 'paused' || next === 'discontinued') return true;
  return nextIdx === currentIdx + 1;
}

export function isLowStock(variant: Pick<XlviiVariant, 'inventoryCount' | 'status'>): boolean {
  return variant.status === 'active' && variant.inventoryCount > 0 && variant.inventoryCount <= 5;
}

export function isOutOfStock(variant: Pick<XlviiVariant, 'inventoryCount' | 'status'>): boolean {
  return variant.status === 'active' && variant.inventoryCount <= 0;
}
