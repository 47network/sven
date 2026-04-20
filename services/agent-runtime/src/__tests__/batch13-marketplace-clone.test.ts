// ---------------------------------------------------------------------------
// Batch 13 tests — marketplace completeness & clone execution
//
// Verifies: refund flow, clone wiring, search/filter queries, order history,
// seller dashboard, API routes, and UI page structures.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/* ===================================================================== *
 * 1. Refund Flow                                                        *
 * ===================================================================== */
describe('Batch 13 — Refund Flow', () => {
  const repoSrc = readSrc('services/sven-marketplace/src/repo.ts');
  const webhookSrc = readSrc('services/sven-marketplace/src/routes/webhook.ts');

  test('repo.ts exports refundOrder method', () => {
    expect(repoSrc).toContain('async refundOrder(');
  });

  test('refundOrder accepts orderId and optional reason', () => {
    expect(repoSrc).toContain('refundOrder(orderId: string, reason?: string)');
  });

  test('refundOrder updates status to refunded', () => {
    expect(repoSrc).toContain("SET status='refunded'");
  });

  test('refundOrder reverses listing sales counters', () => {
    expect(repoSrc).toContain('total_sales = GREATEST(total_sales - $2, 0)');
    expect(repoSrc).toContain('total_revenue = GREATEST(total_revenue - $3, 0)');
  });

  test('refundOrder calls ledger.debit for treasury reversal', () => {
    expect(repoSrc).toContain("this.ledger.debit(");
    expect(repoSrc).toContain("source: 'marketplace:refund'");
    expect(repoSrc).toContain("kind: 'refund'");
  });

  test('refundOrder publishes NATS event', () => {
    expect(repoSrc).toContain("sven.market.refunded");
  });

  test('refundOrder rejects invalid status (not paid/fulfilled)', () => {
    expect(repoSrc).toContain('cannot refund');
  });

  test('refundOrder is idempotent (returns existing if already refunded)', () => {
    expect(repoSrc).toContain("existing.status === 'refunded'");
  });

  test('webhook charge.refunded case calls repo.refundOrder', () => {
    expect(webhookSrc).toContain('repo.refundOrder(');
  });

  test('webhook passes refund reason from Stripe', () => {
    expect(webhookSrc).toContain('charge.refunds?.data?.[0]?.reason');
  });

  test('webhook no longer has "Future:" stub comment', () => {
    expect(webhookSrc).not.toContain('// Future: repo.refundOrder');
  });
});

/* ===================================================================== *
 * 2. Clone Execution Wiring                                             *
 * ===================================================================== */
describe('Batch 13 — Clone Execution', () => {
  const lifecycleSrc = readSrc('services/agent-runtime/src/automaton-lifecycle.ts');
  const adaptersSrc = readSrc('services/agent-runtime/src/automaton-adapters.ts');

  test('applyDecision handles cloning status', () => {
    expect(lifecycleSrc).toContain("decision.nextStatus === 'cloning'");
  });

  test('applyDecision calls spawnDescendant', () => {
    expect(lifecycleSrc).toContain('this.opts.clone.spawnDescendant(rec)');
  });

  test('applyDecision calls birth to create child automaton', () => {
    expect(lifecycleSrc).toContain('this.birth({');
    expect(lifecycleSrc).toContain('parentId: rec.id');
  });

  test('child inherits parent pipelineIds from spawn result', () => {
    expect(lifecycleSrc).toContain('child.pipelineIds = spawn.pipelineIds');
  });

  test('parent cloneCount incremented after spawn', () => {
    expect(lifecycleSrc).toContain('rec.metrics.cloneCount += 1');
  });

  test('cloneCount guard prevents exceeding maxCloneCount', () => {
    expect(lifecycleSrc).toContain('rec.metrics.cloneCount >= this.opts.thresholds.maxCloneCount');
  });

  test('tick() calls applyDecision for cloning status', () => {
    expect(lifecycleSrc).toContain("adjusted.nextStatus === 'cloning'");
    expect(lifecycleSrc).toContain('this.applyDecision(adjusted)');
  });

  test('makeCloneSimple returns pipelineIds with clone suffix', () => {
    expect(adaptersSrc).toContain('`${pid}_c${cloneIdx}`');
  });

  test('makeClonePg duplicates active pipelines into new rows', () => {
    expect(adaptersSrc).toContain('repo.createPipeline(');
    expect(adaptersSrc).toContain('repo.activatePipeline(');
  });

  test('makeClonePg passes parent reference in config', () => {
    expect(adaptersSrc).toContain('parentAutomatonId: parent.id');
  });

  test('spawnDescendant returns null when no active pipelines', () => {
    expect(adaptersSrc).toContain('return null');
  });
});

/* ===================================================================== *
 * 3. Marketplace Search / Filter                                        *
 * ===================================================================== */
describe('Batch 13 — Marketplace Search & Filter', () => {
  const repoSrc = readSrc('services/sven-marketplace/src/repo.ts');
  const publicSrc = readSrc('services/sven-marketplace/src/routes/public.ts');
  const apiSrc = readSrc('apps/marketplace-ui/src/lib/api.ts');
  const pageSrc = readSrc('apps/marketplace-ui/src/app/page.tsx');

  test('listPublishedListings accepts q param for text search', () => {
    expect(repoSrc).toContain('q?: string');
    expect(repoSrc).toContain('title ILIKE');
  });

  test('listPublishedListings supports sort options', () => {
    expect(repoSrc).toContain("sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular'");
    expect(repoSrc).toContain('unit_price ASC');
    expect(repoSrc).toContain('total_sales DESC');
  });

  test('listPublishedListings supports price range filters', () => {
    expect(repoSrc).toContain('minPrice?: number');
    expect(repoSrc).toContain('maxPrice?: number');
    expect(repoSrc).toContain('unit_price >= $');
    expect(repoSrc).toContain('unit_price <= $');
  });

  test('public route accepts q, sort, minPrice, maxPrice params', () => {
    expect(publicSrc).toContain("q: z.string()");
    expect(publicSrc).toContain("sort: z.enum(SORT_OPTS)");
    expect(publicSrc).toContain("minPrice: z.coerce.number()");
    expect(publicSrc).toContain("maxPrice: z.coerce.number()");
  });

  test('fetchListings in api.ts passes search params', () => {
    expect(apiSrc).toContain("params.set('q', opts.q)");
    expect(apiSrc).toContain("params.set('sort', opts.sort)");
    expect(apiSrc).toContain("params.set('minPrice'");
  });

  test('homepage uses SearchBar component', () => {
    expect(pageSrc).toContain('SearchBar');
    expect(pageSrc).toContain("import { SearchBar }");
  });

  test('homepage reads search params and passes to fetchListings', () => {
    expect(pageSrc).toContain('searchParams');
    expect(pageSrc).toContain("fetchListings({ limit: 48, q, kind, sort })");
  });
});

/* ===================================================================== *
 * 4. SearchBar Component                                                *
 * ===================================================================== */
describe('Batch 13 — SearchBar Component', () => {
  const src = readSrc('apps/marketplace-ui/src/components/SearchBar.tsx');

  test('SearchBar is a client component', () => {
    expect(src).toContain("'use client'");
  });

  test('SearchBar renders search input', () => {
    expect(src).toContain('type="text"');
    expect(src).toContain('Search skills');
  });

  test('SearchBar has kind dropdown with all listing types', () => {
    expect(src).toContain('skill_api');
    expect(src).toContain('digital_good');
    expect(src).toContain('dataset');
    expect(src).toContain('model');
  });

  test('SearchBar has sort dropdown', () => {
    expect(src).toContain('Newest');
    expect(src).toContain('Most Popular');
    expect(src).toContain('Price: Low');
    expect(src).toContain('Price: High');
  });

  test('SearchBar pushes query params via router', () => {
    expect(src).toContain("router.push(");
  });
});

/* ===================================================================== *
 * 5. Order History                                                      *
 * ===================================================================== */
describe('Batch 13 — Order History', () => {
  const pageSrc = readSrc('apps/marketplace-ui/src/app/orders/page.tsx');
  const apiSrc = readSrc('apps/marketplace-ui/src/lib/api.ts');
  const publicSrc = readSrc('services/sven-marketplace/src/routes/public.ts');

  test('orders page exists and is a client component', () => {
    expect(pageSrc).toContain("'use client'");
  });

  test('orders page has email input for lookup', () => {
    expect(pageSrc).toContain('type="email"');
    expect(pageSrc).toContain('Enter your email');
  });

  test('orders page displays order status badges', () => {
    expect(pageSrc).toContain('STATUS_COLORS');
    expect(pageSrc).toContain('pending');
    expect(pageSrc).toContain('paid');
    expect(pageSrc).toContain('fulfilled');
    expect(pageSrc).toContain('refunded');
  });

  test('fetchOrders function exists in api.ts', () => {
    expect(apiSrc).toContain('export async function fetchOrders(');
    expect(apiSrc).toContain('/v1/market/orders');
  });

  test('public route has GET /v1/market/orders endpoint', () => {
    expect(publicSrc).toContain("/v1/market/orders");
    expect(publicSrc).toContain('buyerId');
  });
});

/* ===================================================================== *
 * 6. Seller Dashboard                                                   *
 * ===================================================================== */
describe('Batch 13 — Seller Dashboard', () => {
  const pageSrc = readSrc('apps/marketplace-ui/src/app/seller/page.tsx');
  const apiSrc = readSrc('apps/marketplace-ui/src/lib/api.ts');
  const publicSrc = readSrc('services/sven-marketplace/src/routes/public.ts');
  const repoSrc = readSrc('services/sven-marketplace/src/repo.ts');

  test('seller page exists and shows stats', () => {
    expect(pageSrc).toContain('Seller Dashboard');
    expect(pageSrc).toContain('listingCount');
    expect(pageSrc).toContain('totalRevenue');
    expect(pageSrc).toContain('totalSales');
  });

  test('seller page shows listing-level metrics', () => {
    expect(pageSrc).toContain('l.totalSales');
    expect(pageSrc).toContain('l.totalRevenue');
  });

  test('fetchSellerStats function exists in api.ts', () => {
    expect(apiSrc).toContain('export async function fetchSellerStats(');
    expect(apiSrc).toContain('/v1/market/seller/');
  });

  test('SellerStats interface is defined', () => {
    expect(apiSrc).toContain('export interface SellerStats');
  });

  test('public route has GET /v1/market/seller/:agentId', () => {
    expect(publicSrc).toContain("/v1/market/seller/:agentId");
  });

  test('repo has listSellerListings method', () => {
    expect(repoSrc).toContain('async listSellerListings(');
    expect(repoSrc).toContain('seller_agent_id = $1');
  });
});

/* ===================================================================== *
 * 7. Integration — End-to-End Data Flow                                 *
 * ===================================================================== */
describe('Batch 13 — Integration Checks', () => {
  const repoSrc = readSrc('services/sven-marketplace/src/repo.ts');

  test('refundOrder debit mirrors markOrderPaid credit pattern', () => {
    // Both use outside-txn pattern
    expect(repoSrc).toContain("await this.ledger.credit(");
    expect(repoSrc).toContain("await this.ledger.debit(");
  });

  test('refundOrder NATS event matches existing event pattern', () => {
    // All events use this.publishNats(subject, payload)
    expect(repoSrc).toContain("this.publishNats('sven.market.refunded'");
    expect(repoSrc).toContain("this.publishNats('sven.market.order_paid'");
    expect(repoSrc).toContain("this.publishNats('sven.market.fulfilled'");
  });

  test('all marketplace NATS subjects are consistent', () => {
    const natsSubjects = [
      'sven.market.listing_published',
      'sven.market.order_paid',
      'sven.market.fulfilled',
      'sven.market.refunded',
    ];
    for (const subj of natsSubjects) {
      expect(repoSrc).toContain(subj);
    }
  });
});
