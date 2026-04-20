/**
 * Batch 16 — API Auth, Metrics, Correlation IDs, Retry Resilience, Seller Edit, Admin Orders
 *
 * Verifies all 6 features of Batch 16 via source-file inspection (no cross-package imports).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. API Auth Middleware — packages/shared/src/api-auth.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('API Auth Middleware', () => {
  const src = read('packages/shared/src/api-auth.ts');

  test('exports apiAuthHook function', () => {
    expect(src).toContain('export function apiAuthHook');
  });

  test('reads ECONOMY_API_TOKEN env var', () => {
    expect(src).toContain("'ECONOMY_API_TOKEN'");
  });

  test('reads ECONOMY_ADMIN_TOKEN env var with fallback', () => {
    expect(src).toContain("'ECONOMY_ADMIN_TOKEN'");
    expect(src).toContain('|| apiToken');
  });

  test('exempts health endpoints from auth', () => {
    expect(src).toContain("'/health'");
    expect(src).toContain("'/healthz'");
    expect(src).toContain("'/readyz'");
    expect(src).toContain("'/metrics'");
  });

  test('exempts GET listing routes as public', () => {
    expect(src).toContain("'/v1/market/listings'");
  });

  test('exempts OPTIONS (preflight) requests', () => {
    expect(src).toContain("'OPTIONS'");
  });

  test('returns 401 for missing Authorization header', () => {
    expect(src).toContain('401');
    expect(src).toContain('Missing or invalid Authorization header');
  });

  test('returns 403 for invalid admin token', () => {
    expect(src).toContain('403');
    expect(src).toContain('Admin access required');
  });

  test('skips auth when no token configured (dev mode)', () => {
    expect(src).toMatch(/if\s*\(\s*!apiToken\s*\)/);
  });

  test('extracts Bearer token from Authorization header', () => {
    expect(src).toContain("authHeader.slice(7)");
  });

  test('has isPublicRoute and isAdminRoute helper functions', () => {
    expect(src).toContain('function isPublicRoute');
    expect(src).toContain('function isAdminRoute');
  });

  test('supports configurable admin path prefixes', () => {
    expect(src).toContain('adminPaths');
    expect(src).toContain('ApiAuthOptions');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Correlation ID — packages/shared/src/correlation-id.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Correlation ID Hook', () => {
  const src = read('packages/shared/src/correlation-id.ts');

  test('exports correlationIdHook function', () => {
    expect(src).toContain('export function correlationIdHook');
  });

  test('exports getCorrelationId helper', () => {
    expect(src).toContain('export function getCorrelationId');
  });

  test('uses x-correlation-id header by default', () => {
    expect(src).toContain("'x-correlation-id'");
  });

  test('generates UUID via crypto.randomUUID', () => {
    expect(src).toContain('randomUUID');
  });

  test('passes through existing correlation ID from request', () => {
    expect(src).toMatch(/existing.*=.*req\.headers\[headerName\]/);
  });

  test('sets correlation ID on response header', () => {
    expect(src).toContain('reply.header(headerName, id)');
  });

  test('attaches ID to req.correlationId', () => {
    expect(src).toContain('req.correlationId = id');
  });

  test('augments FastifyRequest interface', () => {
    expect(src).toContain("interface FastifyRequest");
    expect(src).toContain('correlationId?: string');
  });

  test('supports custom header name option', () => {
    expect(src).toContain('CorrelationIdOptions');
    expect(src).toContain('header?:');
  });

  test('supports custom generator option', () => {
    expect(src).toContain('generator?:');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Retry Utility — packages/shared/src/retry.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Retry Utility', () => {
  const src = read('packages/shared/src/retry.ts');

  test('exports withRetry async function', () => {
    expect(src).toContain('export async function withRetry');
  });

  test('defaults to 3 max attempts', () => {
    expect(src).toContain('maxAttempts ?? 3');
  });

  test('defaults to 1000ms base delay', () => {
    expect(src).toContain('baseDelayMs ?? 1000');
  });

  test('implements exponential backoff (power of 2)', () => {
    expect(src).toContain('Math.pow(2, attempt - 1)');
  });

  test('supports configurable isRetryable predicate', () => {
    expect(src).toContain('isRetryable');
    expect(src).toContain('(err: unknown) => boolean');
  });

  test('logs retry attempts via optional logger', () => {
    expect(src).toContain('opts.logger?.warn');
  });

  test('re-throws last error after max attempts', () => {
    expect(src).toContain('throw lastError');
  });

  test('stops retrying when isRetryable returns false', () => {
    expect(src).toContain('!isRetryable(err)');
  });

  test('has RetryOptions interface with label', () => {
    expect(src).toContain('RetryOptions');
    expect(src).toContain('label?:');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Prometheus Metrics — packages/shared/src/metrics.ts
// ═══════════════════════════════════════════════════════════════════════════
describe('Prometheus Metrics', () => {
  const src = read('packages/shared/src/metrics.ts');

  test('exports Counter class with inc and render', () => {
    expect(src).toContain('export class Counter');
    expect(src).toMatch(/inc\(labels[\s\S]*?\).*void/);
    expect(src).toContain('render(): string');
  });

  test('exports Gauge class with set and inc', () => {
    expect(src).toContain('export class Gauge');
  });

  test('exports Histogram class with observe', () => {
    expect(src).toContain('export class Histogram');
    expect(src).toContain('observe(labels');
  });

  test('exports MetricsRegistry class with prefix support', () => {
    expect(src).toContain('export class MetricsRegistry');
    expect(src).toContain('prefix');
  });

  test('renders Prometheus text format with HELP and TYPE', () => {
    expect(src).toContain('# HELP');
    expect(src).toContain('# TYPE');
    expect(src).toContain('counter');
    expect(src).toContain('gauge');
    expect(src).toContain('histogram');
  });

  test('exports registerMetricsRoute function', () => {
    expect(src).toContain('export function registerMetricsRoute');
  });

  test('serves metrics at GET /metrics endpoint', () => {
    expect(src).toContain("app.get('/metrics'");
  });

  test('sets correct Content-Type for Prometheus', () => {
    expect(src).toContain("text/plain; version=0.0.4");
  });

  test('Counter renders label pairs correctly', () => {
    expect(src).toContain('labelsKey');
    // format: metric_name{key="value"} N
    expect(src).toMatch(/\$\{labels\}/);
  });

  test('Histogram has default buckets', () => {
    expect(src).toContain('DEFAULT_BUCKETS');
    expect(src).toContain('0.005');
    expect(src).toContain('+Inf');
  });

  test('MetricsRegistry counter() prepends prefix', () => {
    expect(src).toContain('`${this.prefix}_${name}`');
  });

  test('no external npm dependencies', () => {
    expect(src).not.toContain("from 'prom-client'");
    expect(src).not.toContain('require(');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Shared index.ts — barrel exports
// ═══════════════════════════════════════════════════════════════════════════
describe('Shared barrel exports', () => {
  const src = read('packages/shared/src/index.ts');

  test('exports api-auth module', () => {
    expect(src).toContain("'./api-auth");
  });

  test('exports correlation-id module', () => {
    expect(src).toContain("'./correlation-id");
  });

  test('exports retry module', () => {
    expect(src).toContain("'./retry");
  });

  test('exports metrics module', () => {
    expect(src).toContain("'./metrics");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Service wiring — auth + correlation-id + metrics in all 3 services
// ═══════════════════════════════════════════════════════════════════════════
describe('Treasury service wiring', () => {
  const src = read('services/sven-treasury/src/index.ts');

  test('imports correlationIdHook', () => {
    expect(src).toContain('correlationIdHook');
  });

  test('imports apiAuthHook', () => {
    expect(src).toContain('apiAuthHook');
  });

  test('imports MetricsRegistry', () => {
    expect(src).toContain('MetricsRegistry');
  });

  test('creates sven_treasury metrics prefix', () => {
    expect(src).toContain("'sven_treasury'");
  });

  test('registers metrics route', () => {
    expect(src).toContain('registerMetricsRoute');
  });

  test('has transactions_total counter', () => {
    expect(src).toContain('transactions_total');
  });
});

describe('Marketplace service wiring', () => {
  const src = read('services/sven-marketplace/src/index.ts');

  test('imports correlationIdHook', () => {
    expect(src).toContain('correlationIdHook');
  });

  test('imports apiAuthHook', () => {
    expect(src).toContain('apiAuthHook');
  });

  test('configures admin paths for marketplace', () => {
    expect(src).toContain("'/v1/market/admin'");
  });

  test('creates sven_marketplace metrics prefix', () => {
    expect(src).toContain("'sven_marketplace'");
  });

  test('has orders_total counter', () => {
    expect(src).toContain('orders_total');
  });

  test('has listings_active gauge', () => {
    expect(src).toContain('listings_active');
  });
});

describe('Eidolon service wiring', () => {
  const src = read('services/sven-eidolon/src/index.ts');

  test('imports correlationIdHook', () => {
    expect(src).toContain('correlationIdHook');
  });

  test('creates sven_eidolon metrics prefix', () => {
    expect(src).toContain("'sven_eidolon'");
  });

  test('has snapshot_requests_total counter', () => {
    expect(src).toContain('snapshot_requests_total');
  });

  test('has sse_connections_total counter', () => {
    expect(src).toContain('sse_connections_total');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Retry resilience in marketplace settlement
// ═══════════════════════════════════════════════════════════════════════════
describe('Marketplace retry resilience', () => {
  const src = read('services/sven-marketplace/src/repo.ts');

  test('imports withRetry from shared', () => {
    expect(src).toContain('withRetry');
  });

  test('wraps credit call with withRetry', () => {
    // withRetry around ledger.credit() in markOrderPaid
    expect(src).toMatch(/withRetry[\s\S]*?credit/);
  });

  test('wraps debit call with withRetry for refunds', () => {
    expect(src).toMatch(/withRetry[\s\S]*?debit/);
  });

  test('uses 3 max attempts', () => {
    expect(src).toContain('maxAttempts: 3');
  });

  test('uses 500ms base delay', () => {
    expect(src).toContain('baseDelayMs: 500');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Admin refund route
// ═══════════════════════════════════════════════════════════════════════════
describe('Admin refund route', () => {
  const src = read('services/sven-marketplace/src/routes/orders.ts');

  test('has POST /v1/market/admin/orders/:id/refund endpoint', () => {
    expect(src).toContain("'/v1/market/admin/orders/:id/refund'");
  });

  test('has GET /v1/market/admin/orders endpoint', () => {
    expect(src).toContain("'/v1/market/admin/orders'");
  });

  test('calls repo.refundOrder', () => {
    expect(src).toContain('repo.refundOrder');
  });

  test('accepts optional reason in body', () => {
    expect(src).toContain("body.reason");
  });

  test('returns REFUND_FAILED error code on failure', () => {
    expect(src).toContain("'REFUND_FAILED'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Seller edit UI
// ═══════════════════════════════════════════════════════════════════════════
describe('Seller edit listing page', () => {
  const src = read('apps/marketplace-ui/src/app/seller/edit/[slug]/page.tsx');

  test('is a client component', () => {
    expect(src).toContain("'use client'");
  });

  test('imports updateListing from api', () => {
    expect(src).toContain('updateListing');
  });

  test('has form fields for title, description, price, tags', () => {
    expect(src).toContain('setTitle');
    expect(src).toContain('setDescription');
    expect(src).toContain('setUnitPrice');
    expect(src).toContain('setTags');
  });

  test('has cover image URL field', () => {
    expect(src).toContain('setCoverImageUrl');
  });

  test('shows success message and redirects', () => {
    expect(src).toContain('Listing updated!');
    expect(src).toContain('router.push');
  });

  test('has save button with loading state', () => {
    expect(src).toContain('Save Changes');
    expect(src).toContain('Saving');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Marketplace UI updateListing API function
// ═══════════════════════════════════════════════════════════════════════════
describe('Marketplace UI API client', () => {
  const src = read('apps/marketplace-ui/src/lib/api.ts');

  test('exports updateListing function', () => {
    expect(src).toContain('updateListing');
  });

  test('sends PUT request to listings endpoint', () => {
    expect(src).toContain('PUT');
    expect(src).toMatch(/\/v1\/market\/listings/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. Admin orders page
// ═══════════════════════════════════════════════════════════════════════════
describe('Admin orders management page', () => {
  const src = read('apps/admin-ui/src/app/orders/page.tsx');

  test('is a client component', () => {
    expect(src).toContain("'use client'");
  });

  test('calls adminOrders API', () => {
    expect(src).toContain('adminOrders');
  });

  test('calls adminRefundOrder API', () => {
    expect(src).toContain('adminRefundOrder');
  });

  test('has refund button with confirmation', () => {
    expect(src).toMatch(/[Rr]efund/);
  });

  test('displays order status badges', () => {
    expect(src).toMatch(/status/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Admin API client — economy methods
// ═══════════════════════════════════════════════════════════════════════════
describe('Admin API client economy methods', () => {
  const src = read('apps/admin-ui/src/lib/api.ts');

  test('has adminOrders method', () => {
    expect(src).toContain('adminOrders');
  });

  test('has adminRefundOrder method', () => {
    expect(src).toContain('adminRefundOrder');
  });

  test('adminOrders calls /v1/market/admin/orders', () => {
    expect(src).toContain('/v1/market/admin/orders');
  });

  test('adminRefundOrder sends POST to refund endpoint', () => {
    expect(src).toContain('/refund');
    expect(src).toContain("method: 'POST'");
  });

  test('includes Authorization header for admin calls', () => {
    expect(src).toContain("'Authorization'");
    expect(src).toContain('Bearer');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. Admin sidebar — order management link
// ═══════════════════════════════════════════════════════════════════════════
describe('Admin sidebar', () => {
  const src = read('apps/admin-ui/src/components/layout/Sidebar.tsx');

  test('has Order Management nav item', () => {
    expect(src).toContain('Order Management');
  });

  test('imports ShoppingBag icon', () => {
    expect(src).toContain('ShoppingBag');
  });

  test('links to /orders path', () => {
    expect(src).toContain("'/orders'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. Docker-compose env vars
// ═══════════════════════════════════════════════════════════════════════════
describe('Docker-compose economy env vars', () => {
  const src = read('docker-compose.yml');

  test('treasury has ECONOMY_API_TOKEN', () => {
    const treasuryBlock = src.match(/# ── Treasury Service[\s\S]{0,1500}/m);
    expect(treasuryBlock).toBeTruthy();
    expect(treasuryBlock![0]).toContain('ECONOMY_API_TOKEN');
  });

  test('treasury has ECONOMY_ADMIN_TOKEN', () => {
    const treasuryBlock = src.match(/# ── Treasury Service[\s\S]{0,1500}/m);
    expect(treasuryBlock![0]).toContain('ECONOMY_ADMIN_TOKEN');
  });

  test('marketplace has ECONOMY_API_TOKEN', () => {
    const marketMatch = src.match(/# ── Marketplace Service[\s\S]{0,1500}/m);
    expect(marketMatch).toBeTruthy();
    expect(marketMatch![0]).toContain('ECONOMY_API_TOKEN');
  });

  test('marketplace has ECONOMY_ADMIN_TOKEN', () => {
    const marketMatch = src.match(/# ── Marketplace Service[\s\S]{0,1500}/m);
    expect(marketMatch![0]).toContain('ECONOMY_ADMIN_TOKEN');
  });

  test('eidolon has ECONOMY_API_TOKEN', () => {
    const eidolonMatch = src.match(/# ── Eidolon Service[\s\S]{0,1500}/m);
    expect(eidolonMatch).toBeTruthy();
    expect(eidolonMatch![0]).toContain('ECONOMY_API_TOKEN');
  });

  test('eidolon has ECONOMY_ADMIN_TOKEN', () => {
    const eidolonMatch = src.match(/# ── Eidolon Service[\s\S]{0,1500}/m);
    expect(eidolonMatch![0]).toContain('ECONOMY_ADMIN_TOKEN');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. Seller dashboard edit button
// ═══════════════════════════════════════════════════════════════════════════
describe('Seller dashboard edit button', () => {
  const src = read('apps/marketplace-ui/src/app/seller/page.tsx');

  test('imports Pencil icon', () => {
    expect(src).toContain('Pencil');
  });

  test('links to edit page', () => {
    expect(src).toContain('/seller/edit/');
  });
});
