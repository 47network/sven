// ---------------------------------------------------------------------------
// Batch 10 Tests — NATS Publishing + Auto-Publisher + Revenue Analytics
// ---------------------------------------------------------------------------
// Covers:
//   1. NATS publishNats helper (treasury + marketplace)
//   2. Auto-publisher skill discovery + pricing
//   3. Economy routes structure (treasury + marketplace)
//   4. Revenue analytics dashboard page structure
//   5. Admin sidebar economy nav links
//   6. Admin API client economy methods
// ---------------------------------------------------------------------------

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');

// ---------------------------------------------------------------------------
// 1. NATS publishNats — treasury transactions.ts
// ---------------------------------------------------------------------------
describe('NATS publishing — treasury', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'services/sven-treasury/src/routes/transactions.ts'),
    'utf-8',
  );

  test('imports NatsConnection type', () => {
    expect(src).toMatch(/import.*NatsConnection/);
  });

  test('defines publishNats helper', () => {
    expect(src).toMatch(/function publishNats/);
  });

  test('publishes sven.treasury.credit on credit', () => {
    expect(src).toContain("'sven.treasury.credit'");
  });

  test('publishes sven.treasury.debit on debit', () => {
    expect(src).toContain("'sven.treasury.debit'");
  });

  test('registerTransactionRoutes accepts nc parameter', () => {
    expect(src).toMatch(/registerTransactionRoutes[\s\S]*NatsConnection/);
  });

  test('publishNats handles null nc gracefully', () => {
    expect(src).toMatch(/if\s*\(\s*!nc\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// 2. NATS publishNats — marketplace repo.ts
// ---------------------------------------------------------------------------
describe('NATS publishing — marketplace', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'services/sven-marketplace/src/repo.ts'),
    'utf-8',
  );

  test('imports NatsConnection type', () => {
    expect(src).toMatch(/import.*NatsConnection/);
  });

  test('MarketplaceRepository has publishNats method', () => {
    expect(src).toMatch(/publishNats\s*\(/);
  });

  test('publishes sven.market.listing_published', () => {
    expect(src).toContain("'sven.market.listing_published'");
  });

  test('publishes sven.market.order_paid', () => {
    expect(src).toContain("'sven.market.order_paid'");
  });

  test('publishes sven.market.fulfilled', () => {
    expect(src).toContain("'sven.market.fulfilled'");
  });
});

describe('NATS wiring — marketplace index', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'services/sven-marketplace/src/index.ts'),
    'utf-8',
  );

  test('connects to NATS', () => {
    expect(src).toMatch(/connect\s*\(/);
    expect(src).toContain('NATS_URL');
  });

  test('passes nc to MarketplaceRepository', () => {
    expect(src).toMatch(/new MarketplaceRepository.*nc/);
  });

  test('drains NATS on shutdown', () => {
    expect(src).toMatch(/nc.*drain/);
  });
});

// ---------------------------------------------------------------------------
// 3. Auto-publisher — skill scanning
// ---------------------------------------------------------------------------
describe('auto-publisher', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'services/agent-runtime/src/auto-publisher.ts'),
    'utf-8',
  );

  test('exports discoverSkills function', () => {
    expect(src).toMatch(/export function discoverSkills/);
  });

  test('exports runAutoPublish function', () => {
    expect(src).toMatch(/export async function runAutoPublish/);
  });

  test('exports startAutoPublisher function', () => {
    expect(src).toMatch(/export function startAutoPublisher/);
  });

  test('exports stopAutoPublisher function', () => {
    expect(src).toMatch(/export function stopAutoPublisher/);
  });

  test('parses SKILL.md YAML frontmatter', () => {
    expect(src).toMatch(/parseSkillMd/);
    expect(src).toContain('---');
  });

  test('uses SVEN_AUTO_PUBLISH_ENABLED guard', () => {
    expect(src).toContain('SVEN_AUTO_PUBLISH_ENABLED');
  });

  test('premium skill pricing identifies correct skills', () => {
    expect(src).toContain("'trading'");
    expect(src).toContain("'security'");
    expect(src).toContain("'quantum'");
    expect(src).toContain("'0.10'");
    expect(src).toContain("'0.01'");
  });

  test('creates listings via marketplace API', () => {
    expect(src).toContain('/v1/market/listings');
    expect(src).toContain("'skill_api'");
    expect(src).toContain("'per_call'");
  });

  test('sets up 24h interval', () => {
    expect(src).toContain('24 * 60 * 60 * 1000');
    expect(src).toMatch(/setInterval/);
  });
});

describe('auto-publisher wiring in agent-runtime', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'services/agent-runtime/src/index.ts'),
    'utf-8',
  );

  test('imports auto-publisher', () => {
    expect(src).toMatch(/import.*auto-publisher/);
  });

  test('calls startAutoPublisher', () => {
    expect(src).toContain('startAutoPublisher');
  });

  test('calls stopAutoPublisher on shutdown', () => {
    expect(src).toContain('stopAutoPublisher');
  });
});

// ---------------------------------------------------------------------------
// 4. Economy routes — treasury
// ---------------------------------------------------------------------------
describe('economy routes — treasury', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'services/sven-treasury/src/routes/economy.ts'),
    'utf-8',
  );

  test('exports registerEconomyRoutes', () => {
    expect(src).toMatch(/export async function registerEconomyRoutes/);
  });

  test('defines GET /economy/summary', () => {
    expect(src).toContain("'/economy/summary'");
  });

  test('summary aggregates balance, revenue, cost', () => {
    expect(src).toContain('totalBalance');
    expect(src).toContain('totalRevenue');
    expect(src).toContain('totalCost');
    expect(src).toContain('netProfit');
  });

  test('defines GET /economy/transactions', () => {
    expect(src).toContain("'/economy/transactions'");
  });

  test('transactions support pagination', () => {
    expect(src).toContain('LIMIT');
    expect(src).toContain('OFFSET');
  });
});

describe('economy routes registered in treasury index', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'services/sven-treasury/src/index.ts'),
    'utf-8',
  );

  test('imports registerEconomyRoutes', () => {
    expect(src).toMatch(/import.*registerEconomyRoutes/);
  });

  test('calls registerEconomyRoutes', () => {
    expect(src).toContain('registerEconomyRoutes');
  });
});

// ---------------------------------------------------------------------------
// 5. Economy routes — marketplace
// ---------------------------------------------------------------------------
describe('economy routes — marketplace', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'services/sven-marketplace/src/routes/economy.ts'),
    'utf-8',
  );

  test('exports registerMarketEconomyRoutes', () => {
    expect(src).toMatch(/export async function registerMarketEconomyRoutes/);
  });

  test('defines GET /economy/top-listings', () => {
    expect(src).toContain("'/economy/top-listings'");
  });

  test('defines GET /economy/stats', () => {
    expect(src).toContain("'/economy/stats'");
  });

  test('top listings ordered by revenue', () => {
    expect(src).toContain('ORDER BY total_revenue DESC');
  });
});

describe('marketplace economy routes registered', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'services/sven-marketplace/src/index.ts'),
    'utf-8',
  );

  test('imports registerMarketEconomyRoutes', () => {
    expect(src).toMatch(/import.*registerMarketEconomyRoutes/);
  });

  test('calls registerMarketEconomyRoutes', () => {
    expect(src).toContain('registerMarketEconomyRoutes');
  });
});

// ---------------------------------------------------------------------------
// 6. Revenue analytics dashboard
// ---------------------------------------------------------------------------
describe('revenue analytics dashboard', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'apps/admin-ui/src/app/revenue-analytics/page.tsx'),
    'utf-8',
  );

  test('is a client component', () => {
    expect(src).toContain("'use client'");
  });

  test('imports useQuery from tanstack', () => {
    expect(src).toMatch(/import.*useQuery.*@tanstack\/react-query/);
  });

  test('imports api from lib/api', () => {
    expect(src).toMatch(/import.*api.*@\/lib\/api/);
  });

  test('imports StatCard and PageHeader', () => {
    expect(src).toContain('StatCard');
    expect(src).toContain('PageHeader');
  });

  test('displays treasury balance stat card', () => {
    expect(src).toContain('Treasury Balance');
  });

  test('displays total revenue stat card', () => {
    expect(src).toContain('Total Revenue');
  });

  test('displays total cost stat card', () => {
    expect(src).toContain('Total Cost');
  });

  test('displays net profit stat card', () => {
    expect(src).toContain('Net Profit');
  });

  test('has top listings section', () => {
    expect(src).toContain('Top Listings by Revenue');
  });

  test('has recent transactions section', () => {
    expect(src).toContain('Recent Transactions');
  });

  test('auto-refreshes with 15s interval', () => {
    expect(src).toContain('refetchInterval: 15_000');
  });

  test('uses economy API methods', () => {
    expect(src).toContain('api.economy.summary');
    expect(src).toContain('api.economy.transactions');
    expect(src).toContain('api.economy.topListings');
  });
});

// ---------------------------------------------------------------------------
// 7. Admin sidebar economy nav
// ---------------------------------------------------------------------------
describe('admin sidebar economy section', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'apps/admin-ui/src/components/layout/Sidebar.tsx'),
    'utf-8',
  );

  test('has Economy nav group', () => {
    expect(src).toContain("label: 'Economy'");
  });

  test('links to revenue-analytics page', () => {
    expect(src).toContain("href: '/revenue-analytics'");
  });

  test('links to automatons page', () => {
    expect(src).toContain("href: '/automatons'");
  });
});

// ---------------------------------------------------------------------------
// 8. Admin API client economy namespace
// ---------------------------------------------------------------------------
describe('admin API client economy namespace', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'apps/admin-ui/src/lib/api.ts'),
    'utf-8',
  );

  test('has economy namespace', () => {
    expect(src).toContain('economy:');
  });

  test('economy.summary method exists', () => {
    expect(src).toMatch(/summary.*=>\s*\n?\s*Promise/s);
  });

  test('economy.transactions method exists', () => {
    expect(src).toMatch(/transactions.*=>/);
  });

  test('economy.topListings method exists', () => {
    expect(src).toMatch(/topListings.*=>/);
  });

  test('fetches from treasury URL', () => {
    expect(src).toContain('NEXT_PUBLIC_TREASURY_URL');
  });

  test('fetches from marketplace URL', () => {
    expect(src).toContain('NEXT_PUBLIC_MARKETPLACE_URL');
  });
});
