// ---------------------------------------------------------------------------
// Revenue Pipeline Engine (I.3) — DEPRECATED in-memory shim
// ---------------------------------------------------------------------------
// ⚠️  Deprecated: use `RevenuePipelineRepository` from
// `./revenue-pipeline-repo` for production. This file remains only for
// local/testing scaffolding and will be removed once every consumer has
// migrated. New code MUST NOT import from this module.
// ---------------------------------------------------------------------------
// Connects revenue sources to the treasury engine.
// Manages pipelines: service marketplace, product deployment,
// content creation, XLVII brand merchandise.
// ---------------------------------------------------------------------------

import { createLogger } from '@sven/shared';

const logger = createLogger('revenue-pipeline');

/* ------------------------------------------------------------------ types */

export type PipelineType = 'service_marketplace' | 'product_deployment' | 'content_creation' | 'merchandise' | 'custom';
export type PipelineStatus = 'draft' | 'active' | 'paused' | 'archived' | 'error';
export type PayoutSchedule = 'instant' | 'daily' | 'weekly' | 'monthly';
export type ContentType = 'blog_post' | 'social_media' | 'video' | 'newsletter' | 'course';
export type MerchCategory = 'clothing' | 'accessories' | 'digital' | 'print' | 'other';

export interface RevenuePipeline {
  id: string;
  orgId: string;
  name: string;
  type: PipelineType;
  status: PipelineStatus;
  config: PipelineConfig;
  metrics: PipelineMetrics;
  createdAt: string;
  updatedAt: string;
  lastRevenueAt: string | null;
}

export interface PipelineConfig {
  /** Target treasury account ID to receive funds */
  treasuryAccountId: string;
  /** Payout schedule */
  payoutSchedule: PayoutSchedule;
  /** Minimum payout threshold in USD */
  minPayoutThreshold: number;
  /** Fee percentage taken by platform/processor */
  platformFeePct: number;
  /** Auto-reinvest percentage (0-100) */
  reinvestPct: number;
  /** Custom config per pipeline type */
  typeConfig: Record<string, unknown>;
}

export interface PipelineMetrics {
  totalRevenue: number;
  totalFees: number;
  netRevenue: number;
  totalPayouts: number;
  pendingPayout: number;
  transactionCount: number;
  avgTransactionSize: number;
  lastDayRevenue: number;
  last7DayRevenue: number;
  last30DayRevenue: number;
}

/* ------------------------------------------ service marketplace (I.3.2) */

export interface ServiceEndpoint {
  id: string;
  pipelineId: string;
  skillName: string;
  path: string;
  method: 'GET' | 'POST';
  pricePerCall: number;
  currency: string;
  rateLimit: number;    // calls per minute
  isPublic: boolean;
  description: string;
  totalCalls: number;
  totalRevenue: number;
  createdAt: string;
}

/* ------------------------------------------ product deployment (I.3.3) */

export interface DeployedProduct {
  id: string;
  pipelineId: string;
  name: string;
  url: string;
  domain: string;
  pricingModel: 'free' | 'freemium' | 'subscription' | 'one_time' | 'usage_based';
  monthlyPrice: number;
  currency: string;
  activeUsers: number;
  mrr: number; // monthly recurring revenue
  createdAt: string;
}

/* ------------------------------------------ content revenue (I.3.4) */

export interface ContentRevenueSource {
  id: string;
  pipelineId: string;
  contentType: ContentType;
  platform: string;
  title: string;
  url: string | null;
  views: number;
  earnings: number;
  cpm: number; // cost per mille
  createdAt: string;
}

/* ------------------------------------------ merchandise (I.3.5 - XLVII Brand) */

export interface MerchProduct {
  id: string;
  pipelineId: string;
  name: string;
  category: MerchCategory;
  sku: string;
  costPrice: number;
  salePrice: number;
  currency: string;
  inventory: number;
  totalSold: number;
  totalRevenue: number;
  printOnDemand: boolean;
  designAssetUrl: string | null;
  createdAt: string;
}

export interface MerchOrder {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  shippingCost: number;
  platformFee: number;
  netRevenue: number;
  customerRegion: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'refunded';
  createdAt: string;
}

/* ------------------------------------------ revenue event */

export interface RevenueEvent {
  id: string;
  pipelineId: string;
  source: string;
  amount: number;
  fees: number;
  netAmount: number;
  currency: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/* ------------------------------------------ pipeline stats */

export interface PipelineStats {
  totalPipelines: number;
  activePipelines: number;
  totalRevenue: number;
  totalFees: number;
  netRevenue: number;
  byType: Record<PipelineType, { count: number; revenue: number }>;
  totalServiceEndpoints: number;
  totalProducts: number;
  totalMerchProducts: number;
  totalContentSources: number;
}

/* ------------------------------------------ defaults */

const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  treasuryAccountId: '',
  payoutSchedule: 'daily',
  minPayoutThreshold: 10,
  platformFeePct: 2.9,
  reinvestPct: 30,
  typeConfig: {},
};

const EMPTY_METRICS: PipelineMetrics = {
  totalRevenue: 0, totalFees: 0, netRevenue: 0,
  totalPayouts: 0, pendingPayout: 0, transactionCount: 0,
  avgTransactionSize: 0, lastDayRevenue: 0,
  last7DayRevenue: 0, last30DayRevenue: 0,
};

/* ------------------------------------------ stores (in-memory) */

const pipelineStore = new Map<string, RevenuePipeline>();
const serviceStore = new Map<string, ServiceEndpoint>();
const productStore = new Map<string, DeployedProduct>();
const contentStore = new Map<string, ContentRevenueSource>();
const merchProductStore = new Map<string, MerchProduct>();
const merchOrderStore = new Map<string, MerchOrder>();
const revenueEventStore = new Map<string, RevenueEvent>();

const MAX_PIPELINES = 50;
const MAX_SERVICES = 200;
const MAX_PRODUCTS = 100;
const MAX_CONTENT = 500;
const MAX_MERCH = 500;
const MAX_ORDERS = 5000;
const MAX_EVENTS = 10000;

let pipelineCounter = 0;
let serviceCounter = 0;
let productCounter = 0;
let contentCounter = 0;
let merchCounter = 0;
let orderCounter = 0;
let eventCounter = 0;

/* ------------------------------------------ pipeline CRUD */

export function createPipeline(params: {
  orgId: string;
  name: string;
  type: PipelineType;
  config?: Partial<PipelineConfig>;
}): RevenuePipeline {
  if (pipelineStore.size >= MAX_PIPELINES) {
    const archived = [...pipelineStore.values()]
      .filter((p) => p.status === 'archived')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (archived.length > 0) pipelineStore.delete(archived[0].id);
    else throw new Error(`Maximum pipeline limit (${MAX_PIPELINES}) reached`);
  }

  pipelineCounter++;
  const id = `pipeline-${Date.now()}-${pipelineCounter}`;
  const now = new Date().toISOString();

  const pipeline: RevenuePipeline = {
    id,
    orgId: params.orgId,
    name: params.name,
    type: params.type,
    status: 'draft',
    config: { ...DEFAULT_PIPELINE_CONFIG, ...params.config },
    metrics: { ...EMPTY_METRICS },
    createdAt: now,
    updatedAt: now,
    lastRevenueAt: null,
  };

  pipelineStore.set(id, pipeline);
  logger.info('Revenue pipeline created', { id, orgId: params.orgId, type: params.type, name: params.name });
  return pipeline;
}

export function getPipeline(id: string): RevenuePipeline | undefined {
  return pipelineStore.get(id);
}

export function listPipelines(orgId?: string, type?: PipelineType): RevenuePipeline[] {
  let pipelines = [...pipelineStore.values()];
  if (orgId) pipelines = pipelines.filter((p) => p.orgId === orgId);
  if (type) pipelines = pipelines.filter((p) => p.type === type);
  return pipelines.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function activatePipeline(id: string): RevenuePipeline | undefined {
  const pipeline = pipelineStore.get(id);
  if (!pipeline) return undefined;
  if (!pipeline.config.treasuryAccountId) {
    throw new Error('Cannot activate pipeline without a treasury account');
  }
  pipeline.status = 'active';
  pipeline.updatedAt = new Date().toISOString();
  logger.info('Revenue pipeline activated', { id });
  return pipeline;
}

export function pausePipeline(id: string): RevenuePipeline | undefined {
  const pipeline = pipelineStore.get(id);
  if (!pipeline) return undefined;
  pipeline.status = 'paused';
  pipeline.updatedAt = new Date().toISOString();
  return pipeline;
}

export function archivePipeline(id: string): RevenuePipeline | undefined {
  const pipeline = pipelineStore.get(id);
  if (!pipeline) return undefined;
  pipeline.status = 'archived';
  pipeline.updatedAt = new Date().toISOString();
  return pipeline;
}

/* ------------------------------------------ revenue recording */

export function recordRevenueEvent(params: {
  pipelineId: string;
  source: string;
  amount: number;
  fees?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}): RevenueEvent {
  const pipeline = pipelineStore.get(params.pipelineId);
  if (!pipeline) throw new Error(`Pipeline ${params.pipelineId} not found`);
  if (pipeline.status !== 'active') throw new Error(`Pipeline ${params.pipelineId} is ${pipeline.status}`);
  if (params.amount <= 0) throw new Error('Revenue amount must be positive');

  const fees = params.fees ?? (params.amount * pipeline.config.platformFeePct / 100);
  const netAmount = params.amount - fees;

  if (revenueEventStore.size >= MAX_EVENTS) {
    const oldest = revenueEventStore.keys().next().value;
    if (oldest) revenueEventStore.delete(oldest);
  }

  eventCounter++;
  const id = `rev-${Date.now()}-${eventCounter}`;

  const event: RevenueEvent = {
    id,
    pipelineId: params.pipelineId,
    source: params.source,
    amount: params.amount,
    fees,
    netAmount,
    currency: params.currency || 'USD',
    metadata: params.metadata || {},
    createdAt: new Date().toISOString(),
  };

  revenueEventStore.set(id, event);

  // Update pipeline metrics
  pipeline.metrics.totalRevenue += params.amount;
  pipeline.metrics.totalFees += fees;
  pipeline.metrics.netRevenue += netAmount;
  pipeline.metrics.pendingPayout += netAmount;
  pipeline.metrics.transactionCount++;
  pipeline.metrics.avgTransactionSize =
    pipeline.metrics.totalRevenue / pipeline.metrics.transactionCount;
  pipeline.lastRevenueAt = event.createdAt;
  pipeline.updatedAt = event.createdAt;

  logger.info('Revenue event recorded', {
    id,
    pipelineId: params.pipelineId,
    source: params.source,
    amount: params.amount,
    fees,
    net: netAmount,
  });

  return event;
}

export function listRevenueEvents(pipelineId?: string, limit = 100): RevenueEvent[] {
  let events = [...revenueEventStore.values()];
  if (pipelineId) events = events.filter((e) => e.pipelineId === pipelineId);
  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/* ------------------------------------------ service marketplace (I.3.2) */

export function registerServiceEndpoint(params: {
  pipelineId: string;
  skillName: string;
  path: string;
  method?: 'GET' | 'POST';
  pricePerCall: number;
  currency?: string;
  rateLimit?: number;
  description: string;
}): ServiceEndpoint {
  const pipeline = pipelineStore.get(params.pipelineId);
  if (!pipeline) throw new Error(`Pipeline ${params.pipelineId} not found`);
  if (pipeline.type !== 'service_marketplace') throw new Error('Pipeline is not a service marketplace');

  if (serviceStore.size >= MAX_SERVICES) {
    throw new Error(`Maximum service endpoint limit (${MAX_SERVICES}) reached`);
  }

  serviceCounter++;
  const id = `svc-${Date.now()}-${serviceCounter}`;

  const endpoint: ServiceEndpoint = {
    id,
    pipelineId: params.pipelineId,
    skillName: params.skillName,
    path: params.path,
    method: params.method || 'POST',
    pricePerCall: params.pricePerCall,
    currency: params.currency || 'USD',
    rateLimit: params.rateLimit || 60,
    isPublic: false,
    description: params.description,
    totalCalls: 0,
    totalRevenue: 0,
    createdAt: new Date().toISOString(),
  };

  serviceStore.set(id, endpoint);
  logger.info('Service endpoint registered', { id, skill: params.skillName, price: params.pricePerCall });
  return endpoint;
}

export function recordServiceCall(endpointId: string): ServiceEndpoint | undefined {
  const endpoint = serviceStore.get(endpointId);
  if (!endpoint) return undefined;
  endpoint.totalCalls++;
  endpoint.totalRevenue += endpoint.pricePerCall;
  return endpoint;
}

export function listServiceEndpoints(pipelineId?: string): ServiceEndpoint[] {
  let endpoints = [...serviceStore.values()];
  if (pipelineId) endpoints = endpoints.filter((e) => e.pipelineId === pipelineId);
  return endpoints;
}

/* ------------------------------------------ product deployment (I.3.3) */

export function registerProduct(params: {
  pipelineId: string;
  name: string;
  url: string;
  domain: string;
  pricingModel: DeployedProduct['pricingModel'];
  monthlyPrice: number;
  currency?: string;
}): DeployedProduct {
  const pipeline = pipelineStore.get(params.pipelineId);
  if (!pipeline) throw new Error(`Pipeline ${params.pipelineId} not found`);
  if (pipeline.type !== 'product_deployment') throw new Error('Pipeline is not a product deployment');

  if (productStore.size >= MAX_PRODUCTS) {
    throw new Error(`Maximum product limit (${MAX_PRODUCTS}) reached`);
  }

  productCounter++;
  const id = `prod-${Date.now()}-${productCounter}`;

  const product: DeployedProduct = {
    id,
    pipelineId: params.pipelineId,
    name: params.name,
    url: params.url,
    domain: params.domain,
    pricingModel: params.pricingModel,
    monthlyPrice: params.monthlyPrice,
    currency: params.currency || 'USD',
    activeUsers: 0,
    mrr: 0,
    createdAt: new Date().toISOString(),
  };

  productStore.set(id, product);
  logger.info('Product registered', { id, name: params.name, pricing: params.pricingModel });
  return product;
}

export function updateProductMetrics(productId: string, activeUsers: number, mrr: number): DeployedProduct | undefined {
  const product = productStore.get(productId);
  if (!product) return undefined;
  product.activeUsers = activeUsers;
  product.mrr = mrr;
  return product;
}

export function listProducts(pipelineId?: string): DeployedProduct[] {
  let products = [...productStore.values()];
  if (pipelineId) products = products.filter((p) => p.pipelineId === pipelineId);
  return products;
}

/* ------------------------------------------ content revenue (I.3.4) */

export function registerContentSource(params: {
  pipelineId: string;
  contentType: ContentType;
  platform: string;
  title: string;
  url?: string;
}): ContentRevenueSource {
  const pipeline = pipelineStore.get(params.pipelineId);
  if (!pipeline) throw new Error(`Pipeline ${params.pipelineId} not found`);
  if (pipeline.type !== 'content_creation') throw new Error('Pipeline is not content creation');

  if (contentStore.size >= MAX_CONTENT) {
    throw new Error(`Maximum content source limit (${MAX_CONTENT}) reached`);
  }

  contentCounter++;
  const id = `content-${Date.now()}-${contentCounter}`;

  const source: ContentRevenueSource = {
    id,
    pipelineId: params.pipelineId,
    contentType: params.contentType,
    platform: params.platform,
    title: params.title,
    url: params.url || null,
    views: 0,
    earnings: 0,
    cpm: 0,
    createdAt: new Date().toISOString(),
  };

  contentStore.set(id, source);
  return source;
}

export function updateContentMetrics(contentId: string, views: number, earnings: number): ContentRevenueSource | undefined {
  const source = contentStore.get(contentId);
  if (!source) return undefined;
  source.views = views;
  source.earnings = earnings;
  source.cpm = views > 0 ? (earnings / views) * 1000 : 0;
  return source;
}

export function listContentSources(pipelineId?: string): ContentRevenueSource[] {
  let sources = [...contentStore.values()];
  if (pipelineId) sources = sources.filter((s) => s.pipelineId === pipelineId);
  return sources;
}

/* ------------------------------------------ merchandise / XLVII Brand (I.3.5) */

export function registerMerchProduct(params: {
  pipelineId: string;
  name: string;
  category: MerchCategory;
  sku: string;
  costPrice: number;
  salePrice: number;
  currency?: string;
  inventory?: number;
  printOnDemand?: boolean;
  designAssetUrl?: string;
}): MerchProduct {
  const pipeline = pipelineStore.get(params.pipelineId);
  if (!pipeline) throw new Error(`Pipeline ${params.pipelineId} not found`);
  if (pipeline.type !== 'merchandise') throw new Error('Pipeline is not merchandise');

  if (merchProductStore.size >= MAX_MERCH) {
    throw new Error(`Maximum merch product limit (${MAX_MERCH}) reached`);
  }

  merchCounter++;
  const id = `merch-${Date.now()}-${merchCounter}`;

  const product: MerchProduct = {
    id,
    pipelineId: params.pipelineId,
    name: params.name,
    category: params.category,
    sku: params.sku,
    costPrice: params.costPrice,
    salePrice: params.salePrice,
    currency: params.currency || 'USD',
    inventory: params.inventory ?? (params.printOnDemand ? Infinity : 0),
    totalSold: 0,
    totalRevenue: 0,
    printOnDemand: params.printOnDemand || false,
    designAssetUrl: params.designAssetUrl || null,
    createdAt: new Date().toISOString(),
  };

  merchProductStore.set(id, product);
  logger.info('Merch product registered', { id, name: params.name, category: params.category, sku: params.sku });
  return product;
}

export function recordMerchOrder(params: {
  productId: string;
  quantity: number;
  shippingCost?: number;
  customerRegion?: string;
}): MerchOrder {
  const product = merchProductStore.get(params.productId);
  if (!product) throw new Error(`Merch product ${params.productId} not found`);
  if (!product.printOnDemand && product.inventory < params.quantity) {
    throw new Error(`Insufficient inventory: ${product.inventory} available, ${params.quantity} requested`);
  }

  const unitPrice = product.salePrice;
  const totalPrice = unitPrice * params.quantity;
  const shippingCost = params.shippingCost || 0;
  const platformFee = totalPrice * 0.029; // Stripe standard
  const costOfGoods = product.costPrice * params.quantity;
  const netRevenue = totalPrice - costOfGoods - shippingCost - platformFee;

  if (merchOrderStore.size >= MAX_ORDERS) {
    const oldest = merchOrderStore.keys().next().value;
    if (oldest) merchOrderStore.delete(oldest);
  }

  orderCounter++;
  const id = `order-${Date.now()}-${orderCounter}`;

  const order: MerchOrder = {
    id,
    productId: params.productId,
    quantity: params.quantity,
    unitPrice,
    totalPrice,
    shippingCost,
    platformFee: Math.round(platformFee * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    customerRegion: params.customerRegion || 'unknown',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  merchOrderStore.set(id, order);

  // Update product metrics
  if (!product.printOnDemand) product.inventory -= params.quantity;
  product.totalSold += params.quantity;
  product.totalRevenue += totalPrice;

  logger.info('Merch order recorded', { id, productId: params.productId, quantity: params.quantity, total: totalPrice });
  return order;
}

export function updateOrderStatus(orderId: string, status: MerchOrder['status']): MerchOrder | undefined {
  const order = merchOrderStore.get(orderId);
  if (!order) return undefined;
  order.status = status;
  return order;
}

export function listMerchProducts(pipelineId?: string): MerchProduct[] {
  let products = [...merchProductStore.values()];
  if (pipelineId) products = products.filter((p) => p.pipelineId === pipelineId);
  return products;
}

export function listMerchOrders(productId?: string, limit = 100): MerchOrder[] {
  let orders = [...merchOrderStore.values()];
  if (productId) orders = orders.filter((o) => o.productId === productId);
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/* ------------------------------------------ pipeline stats */

export function getPipelineStats(orgId?: string): PipelineStats {
  let pipelines = [...pipelineStore.values()];
  if (orgId) pipelines = pipelines.filter((p) => p.orgId === orgId);

  const byType: Record<string, { count: number; revenue: number }> = {};
  let totalRevenue = 0;
  let totalFees = 0;

  for (const p of pipelines) {
    if (!byType[p.type]) byType[p.type] = { count: 0, revenue: 0 };
    byType[p.type].count++;
    byType[p.type].revenue += p.metrics.netRevenue;
    totalRevenue += p.metrics.totalRevenue;
    totalFees += p.metrics.totalFees;
  }

  return {
    totalPipelines: pipelines.length,
    activePipelines: pipelines.filter((p) => p.status === 'active').length,
    totalRevenue,
    totalFees,
    netRevenue: totalRevenue - totalFees,
    byType: byType as Record<PipelineType, { count: number; revenue: number }>,
    totalServiceEndpoints: serviceStore.size,
    totalProducts: productStore.size,
    totalMerchProducts: merchProductStore.size,
    totalContentSources: contentStore.size,
  };
}

/* ------------------------------------------ reset for testing */

export function _resetForTesting(): void {
  pipelineStore.clear();
  serviceStore.clear();
  productStore.clear();
  contentStore.clear();
  merchProductStore.clear();
  merchOrderStore.clear();
  revenueEventStore.clear();
  pipelineCounter = 0;
  serviceCounter = 0;
  productCounter = 0;
  contentCounter = 0;
  merchCounter = 0;
  orderCounter = 0;
  eventCounter = 0;
}
