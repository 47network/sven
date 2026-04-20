// ---------------------------------------------------------------------------
// Sven Marketplace — shared types
// ---------------------------------------------------------------------------

export type ListingKind = 'skill_api' | 'digital_good' | 'service' | 'dataset' | 'model' | 'published_book';
export type PricingModel = 'one_time' | 'per_call' | 'subscription' | 'usage_based';
export type ListingStatus = 'draft' | 'published' | 'paused' | 'retired';
export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'refunded' | 'failed' | 'cancelled';
export type PaymentMethod = 'stripe' | 'crypto_base' | 'internal_credit';
export type FulfillmentStatus = 'queued' | 'running' | 'delivered' | 'failed';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type GoalStatus = 'active' | 'completed' | 'cancelled';

export interface Listing {
  id: string;
  orgId: string;
  sellerAgentId: string | null;
  slug: string;
  title: string;
  description: string;
  kind: ListingKind;
  pricingModel: PricingModel;
  unitPrice: number;
  currency: string;
  payoutAccountId: string | null;
  skillName: string | null;
  endpointUrl: string | null;
  pipelineId: string | null;
  coverImageUrl: string | null;
  tags: string[];
  status: ListingStatus;
  totalSales: number;
  totalRevenue: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface Order {
  id: string;
  listingId: string;
  buyerId: string | null;
  buyerEmail: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  platformFee: number;
  total: number;
  netToSeller: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentRef: string | null;
  status: OrderStatus;
  settlementTxId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
}

export interface Fulfillment {
  id: string;
  orderId: string;
  kind: string;
  payload: Record<string, unknown>;
  status: FulfillmentStatus;
  deliveredAt: string | null;
  createdAt: string;
}

export type BusinessSpaceStatus = 'inactive' | 'pending' | 'active' | 'suspended';
export type BusinessLandingType = 'storefront' | 'portfolio' | 'api_explorer' | 'service_page';

export const PLATFORM_FEE_PCT = Number(process.env.MARKETPLACE_PLATFORM_FEE_PCT || 5);
