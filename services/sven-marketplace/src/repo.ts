// ---------------------------------------------------------------------------
// Marketplace repository — DB helpers for listings, orders, fulfillments.
// Uses the pg Pool passed from index.ts. Every settlement path goes through
// the Treasury Ledger.
// ---------------------------------------------------------------------------

import type { Pool, PoolClient } from 'pg';
import { Ledger } from '@sven/treasury';
import { createLogger } from '@sven/shared';
import {
  Listing,
  ListingKind,
  ListingStatus,
  Order,
  OrderStatus,
  PaymentMethod,
  PricingModel,
  PLATFORM_FEE_PCT,
  Fulfillment,
} from './types.js';

const logger = createLogger('marketplace-repo');

const MAX_LIMIT = 200;

/* --------------------------------------------------------------- row maps */

type ListingRow = {
  id: string; org_id: string; seller_agent_id: string | null;
  slug: string; title: string; description: string;
  kind: ListingKind; pricing_model: PricingModel;
  unit_price: string; currency: string;
  payout_account_id: string | null;
  skill_name: string | null; endpoint_url: string | null;
  pipeline_id: string | null; cover_image_url: string | null;
  tags: string[]; status: ListingStatus;
  total_sales: number; total_revenue: string;
  metadata: Record<string, unknown> | null;
  created_at: Date; updated_at: Date; published_at: Date | null;
};

function toListing(r: ListingRow): Listing {
  return {
    id: r.id, orgId: r.org_id, sellerAgentId: r.seller_agent_id,
    slug: r.slug, title: r.title, description: r.description,
    kind: r.kind, pricingModel: r.pricing_model,
    unitPrice: Number(r.unit_price), currency: r.currency,
    payoutAccountId: r.payout_account_id,
    skillName: r.skill_name, endpointUrl: r.endpoint_url,
    pipelineId: r.pipeline_id, coverImageUrl: r.cover_image_url,
    tags: r.tags ?? [], status: r.status,
    totalSales: r.total_sales, totalRevenue: Number(r.total_revenue),
    metadata: r.metadata ?? {},
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
  };
}

type OrderRow = {
  id: string; listing_id: string;
  buyer_id: string | null; buyer_email: string | null;
  quantity: number; unit_price: string;
  subtotal: string; platform_fee: string; total: string; net_to_seller: string;
  currency: string; payment_method: PaymentMethod;
  payment_ref: string | null; status: OrderStatus;
  settlement_tx_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date; paid_at: Date | null; fulfilled_at: Date | null;
};

function toOrder(r: OrderRow): Order {
  return {
    id: r.id, listingId: r.listing_id,
    buyerId: r.buyer_id, buyerEmail: r.buyer_email,
    quantity: r.quantity, unitPrice: Number(r.unit_price),
    subtotal: Number(r.subtotal), platformFee: Number(r.platform_fee),
    total: Number(r.total), netToSeller: Number(r.net_to_seller),
    currency: r.currency, paymentMethod: r.payment_method,
    paymentRef: r.payment_ref, status: r.status,
    settlementTxId: r.settlement_tx_id,
    metadata: r.metadata ?? {},
    createdAt: r.created_at.toISOString(),
    paidAt: r.paid_at ? r.paid_at.toISOString() : null,
    fulfilledAt: r.fulfilled_at ? r.fulfilled_at.toISOString() : null,
  };
}

/* ---------------------------------------------------------------- helpers */

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
    || `item-${Date.now()}`;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function bounded(n: number | undefined, def: number): number {
  const v = Number.isFinite(n) ? (n as number) | 0 : def;
  return Math.min(Math.max(1, v), MAX_LIMIT);
}

/* ------------------------------------------------------------- repository */

export class MarketplaceRepository {
  constructor(private readonly pool: Pool, private readonly ledger: Ledger) {}

  /* ---------- listings ---------- */

  async createListing(input: {
    orgId: string;
    sellerAgentId?: string | null;
    title: string;
    description?: string;
    kind: ListingKind;
    pricingModel: PricingModel;
    unitPrice: number;
    currency?: string;
    payoutAccountId?: string | null;
    skillName?: string | null;
    endpointUrl?: string | null;
    pipelineId?: string | null;
    coverImageUrl?: string | null;
    tags?: string[];
    metadata?: Record<string, unknown>;
    slug?: string;
  }): Promise<Listing> {
    if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
      throw new Error('unitPrice must be a non-negative finite number');
    }
    const id = newId('lst');
    const slug = (input.slug && input.slug.trim()) || slugify(input.title);

    const res = await this.pool.query<ListingRow>(
      `INSERT INTO marketplace_listings
        (id, org_id, seller_agent_id, slug, title, description, kind,
         pricing_model, unit_price, currency, payout_account_id, skill_name,
         endpoint_url, pipeline_id, cover_image_url, tags, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
       RETURNING *`,
      [
        id, input.orgId, input.sellerAgentId ?? null, slug,
        input.title, input.description ?? '',
        input.kind, input.pricingModel, input.unitPrice, input.currency ?? 'USD',
        input.payoutAccountId ?? null, input.skillName ?? null,
        input.endpointUrl ?? null, input.pipelineId ?? null,
        input.coverImageUrl ?? null, input.tags ?? [],
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    logger.info('Listing created', { id, slug, kind: input.kind });
    return toListing(res.rows[0]);
  }

  async getListing(id: string): Promise<Listing | null> {
    const res = await this.pool.query<ListingRow>(
      `SELECT * FROM marketplace_listings WHERE id = $1`, [id]);
    return res.rows[0] ? toListing(res.rows[0]) : null;
  }

  async getListingBySlug(slug: string): Promise<Listing | null> {
    const res = await this.pool.query<ListingRow>(
      `SELECT * FROM marketplace_listings WHERE slug = $1`, [slug]);
    return res.rows[0] ? toListing(res.rows[0]) : null;
  }

  async listPublishedListings(opts: { kind?: ListingKind; limit?: number } = {}): Promise<Listing[]> {
    const lim = bounded(opts.limit, 50);
    const values: unknown[] = [];
    let where = `status = 'published'`;
    if (opts.kind) { values.push(opts.kind); where += ` AND kind = $${values.length}`; }
    values.push(lim);
    const res = await this.pool.query<ListingRow>(
      `SELECT * FROM marketplace_listings
       WHERE ${where}
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $${values.length}`,
      values,
    );
    return res.rows.map(toListing);
  }

  async listOrgListings(orgId: string, opts: { status?: ListingStatus; limit?: number } = {}): Promise<Listing[]> {
    const lim = bounded(opts.limit, 100);
    const values: unknown[] = [orgId];
    let where = `org_id = $1`;
    if (opts.status) { values.push(opts.status); where += ` AND status = $${values.length}`; }
    values.push(lim);
    const res = await this.pool.query<ListingRow>(
      `SELECT * FROM marketplace_listings
       WHERE ${where} ORDER BY created_at DESC LIMIT $${values.length}`,
      values,
    );
    return res.rows.map(toListing);
  }

  async publishListing(id: string): Promise<Listing | null> {
    const cur = await this.getListing(id);
    if (!cur) return null;
    if (!cur.payoutAccountId) {
      throw new Error('Listing must have payoutAccountId before publishing');
    }
    const res = await this.pool.query<ListingRow>(
      `UPDATE marketplace_listings
       SET status = 'published', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    logger.info('Listing published', { id });
    return res.rows[0] ? toListing(res.rows[0]) : null;
  }

  async pauseListing(id: string): Promise<Listing | null> {
    const res = await this.pool.query<ListingRow>(
      `UPDATE marketplace_listings SET status='paused', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
    return res.rows[0] ? toListing(res.rows[0]) : null;
  }

  async retireListing(id: string): Promise<Listing | null> {
    const res = await this.pool.query<ListingRow>(
      `UPDATE marketplace_listings SET status='retired', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
    return res.rows[0] ? toListing(res.rows[0]) : null;
  }

  /* ---------- orders ---------- */

  /**
   * Create a pending order. No treasury entries yet; settle later via
   * `markOrderPaid` when the payment provider confirms.
   */
  async createOrder(input: {
    listingId: string;
    buyerId?: string | null;
    buyerEmail?: string | null;
    quantity?: number;
    paymentMethod: PaymentMethod;
    paymentRef?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<Order> {
    const listing = await this.getListing(input.listingId);
    if (!listing) throw new Error(`Listing ${input.listingId} not found`);
    if (listing.status !== 'published') {
      throw new Error(`Listing is ${listing.status}, not published`);
    }
    const qty = input.quantity && input.quantity > 0 ? input.quantity | 0 : 1;
    const subtotal = Number((listing.unitPrice * qty).toFixed(4));
    const platformFee = Number((subtotal * PLATFORM_FEE_PCT / 100).toFixed(4));
    const total = Number((subtotal).toFixed(4));
    const netToSeller = Number((subtotal - platformFee).toFixed(4));

    const id = newId('ord');
    const res = await this.pool.query<OrderRow>(
      `INSERT INTO marketplace_orders
        (id, listing_id, buyer_id, buyer_email, quantity, unit_price, subtotal,
         platform_fee, total, net_to_seller, currency, payment_method, payment_ref, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
       RETURNING *`,
      [
        id, input.listingId, input.buyerId ?? null, input.buyerEmail ?? null,
        qty, listing.unitPrice, subtotal, platformFee, total, netToSeller,
        listing.currency, input.paymentMethod, input.paymentRef ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    logger.info('Order created', { id, listingId: input.listingId, total });
    return toOrder(res.rows[0]);
  }

  async getOrder(id: string): Promise<Order | null> {
    const res = await this.pool.query<OrderRow>(
      `SELECT * FROM marketplace_orders WHERE id = $1`, [id]);
    return res.rows[0] ? toOrder(res.rows[0]) : null;
  }

  async listOrders(opts: { listingId?: string; buyerId?: string; status?: OrderStatus; limit?: number } = {}): Promise<Order[]> {
    const lim = bounded(opts.limit, 100);
    const conds: string[] = [];
    const values: unknown[] = [];
    if (opts.listingId) { values.push(opts.listingId); conds.push(`listing_id = $${values.length}`); }
    if (opts.buyerId) { values.push(opts.buyerId); conds.push(`buyer_id = $${values.length}`); }
    if (opts.status) { values.push(opts.status); conds.push(`status = $${values.length}`); }
    values.push(lim);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const res = await this.pool.query<OrderRow>(
      `SELECT * FROM marketplace_orders ${where} ORDER BY created_at DESC LIMIT $${values.length}`,
      values,
    );
    return res.rows.map(toOrder);
  }

  /**
   * Settle a paid order: post net_to_seller to the listing's payout
   * treasury account and mark the order `paid`. Idempotent by design —
   * re-calling with the same order id is a no-op after the first success.
   */
  async markOrderPaid(orderId: string, paymentRef?: string | null): Promise<Order> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query<OrderRow>(
        `SELECT * FROM marketplace_orders WHERE id = $1 FOR UPDATE`, [orderId]);
      const row = lockRes.rows[0];
      if (!row) throw new Error(`Order ${orderId} not found`);
      const existing = toOrder(row);

      if (existing.status === 'paid' || existing.status === 'fulfilled') {
        await client.query('COMMIT');
        return existing;
      }
      if (existing.status !== 'pending') {
        throw new Error(`Order ${orderId} is ${existing.status}; cannot mark paid`);
      }

      const listingRes = await client.query<ListingRow>(
        `SELECT * FROM marketplace_listings WHERE id = $1`, [existing.listingId]);
      const listing = listingRes.rows[0] ? toListing(listingRes.rows[0]) : null;
      if (!listing) throw new Error('Listing missing at settlement');
      if (!listing.payoutAccountId) throw new Error('Listing has no payoutAccountId');

      const updatedRef = paymentRef ?? existing.paymentRef;
      const up = await client.query<OrderRow>(
        `UPDATE marketplace_orders
           SET status='paid', paid_at=NOW(), payment_ref = COALESCE($2, payment_ref)
         WHERE id=$1 RETURNING *`,
        [orderId, updatedRef],
      );

      await client.query(
        `UPDATE marketplace_listings
           SET total_sales = total_sales + $2,
               total_revenue = total_revenue + $3,
               updated_at = NOW()
         WHERE id = $1`,
        [listing.id, existing.quantity, existing.subtotal],
      );

      await client.query('COMMIT');

      // Treasury credit outside txn so its own transaction is independent.
      try {
        const tx = await this.ledger.credit({
          orgId: listing.orgId,
          accountId: listing.payoutAccountId,
          amount: existing.netToSeller,
          currency: existing.currency,
          source: `marketplace:${existing.paymentMethod}`,
          sourceRef: orderId,
          kind: 'revenue',
          description: `Marketplace order ${orderId} for listing ${listing.slug}`,
          metadata: { listingId: listing.id, orderId, platformFee: existing.platformFee },
        });
        await this.pool.query(
          `UPDATE marketplace_orders SET settlement_tx_id=$2 WHERE id=$1`,
          [orderId, tx.id],
        );
      } catch (err) {
        logger.error('Treasury credit failed after order marked paid', {
          orderId, err: err instanceof Error ? err.message : String(err),
        });
      }

      logger.info('Order marked paid', { orderId, net: existing.netToSeller });
      return toOrder(up.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async recordFulfillment(input: {
    orderId: string;
    kind: string;
    payload: Record<string, unknown>;
    status?: 'delivered' | 'failed';
  }): Promise<Fulfillment> {
    const id = newId('ful');
    const status = input.status ?? 'delivered';
    const res = await this.pool.query(
      `INSERT INTO marketplace_fulfillments (id, order_id, kind, payload, status, delivered_at)
       VALUES ($1,$2,$3,$4::jsonb,$5, CASE WHEN $5='delivered' THEN NOW() ELSE NULL END)
       RETURNING id, order_id, kind, payload, status, delivered_at, created_at`,
      [id, input.orderId, input.kind, JSON.stringify(input.payload), status],
    );
    if (status === 'delivered') {
      await this.pool.query(
        `UPDATE marketplace_orders SET status='fulfilled', fulfilled_at=NOW()
         WHERE id=$1 AND status='paid'`,
        [input.orderId],
      );
    }
    const r = res.rows[0];
    return {
      id: r.id, orderId: r.order_id, kind: r.kind, payload: r.payload ?? {},
      status: r.status,
      deliveredAt: r.delivered_at ? r.delivered_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
    };
  }
}
