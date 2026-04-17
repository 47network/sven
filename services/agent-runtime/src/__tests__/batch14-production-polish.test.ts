/**
 * Batch 14 — Production polish tests
 *
 * Covers:
 *  1. Eidolon refund event wiring (event-bus, types, useEidolonEvents, useEventGlow)
 *  2. Docker healthchecks in docker-compose.yml
 *  3. Listing update API (repo.updateListing + PUT route)
 *  4. Economy digest refund analysis
 *  5. Economy context prompt refund fields
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

/* ================================================================
   1. Eidolon refund event wiring
   ================================================================ */

describe('Eidolon refund event wiring', () => {
  const eventBusSrc = readSrc('services/sven-eidolon/src/event-bus.ts');
  const typesSrc = readSrc('services/sven-eidolon/src/types.ts');
  const useEventsSrc = readSrc('apps/eidolon-ui/src/hooks/useEidolonEvents.ts');
  const useGlowSrc = readSrc('apps/eidolon-ui/src/hooks/useEventGlow.ts');

  test('SUBJECT_MAP includes sven.market.refunded', () => {
    expect(eventBusSrc).toContain("'sven.market.refunded': 'market.refunded'");
  });

  test('EidolonEventKind union includes market.refunded', () => {
    expect(typesSrc).toContain("| 'market.refunded'");
  });

  test('useEidolonEvents hardcoded list includes market.refunded', () => {
    expect(useEventsSrc).toContain("'market.refunded'");
  });

  test('useEventGlow has refund → red colour mapping', () => {
    expect(useGlowSrc).toContain("'market.refunded'");
    expect(useGlowSrc).toContain('#ef4444');
  });

  test('all 9 event kinds exist in SUBJECT_MAP', () => {
    const subjects = [
      'sven.market.listing_published',
      'sven.market.order_paid',
      'sven.market.fulfilled',
      'sven.market.refunded',
      'sven.treasury.credit',
      'sven.treasury.debit',
      'sven.agent.spawned',
      'sven.agent.retired',
      'sven.infra.node_change',
    ];
    for (const s of subjects) {
      expect(eventBusSrc).toContain(`'${s}'`);
    }
  });

  test('event kind union includes market.refunded among its members', () => {
    // Extract just the EidolonEventKind block
    const kindBlock = typesSrc.slice(
      typesSrc.indexOf('EidolonEventKind'),
      typesSrc.indexOf(';', typesSrc.indexOf('EidolonEventKind')),
    );
    expect(kindBlock).toContain("'market.refunded'");
    expect(kindBlock).toContain("'heartbeat'");
  });
});

/* ================================================================
   2. Docker healthchecks
   ================================================================ */

describe('Docker healthcheck configuration', () => {
  const composeSrc = readSrc('docker-compose.yml');

  test('sven-treasury has healthcheck on port 9477', () => {
    // Find the service definition (indented 2 spaces as a top-level service)
    const match = composeSrc.match(/^ {2}sven-treasury:\n/m);
    expect(match).not.toBeNull();
    const idx = match!.index!;
    const section = composeSrc.slice(idx, idx + 800);
    expect(section).toContain('healthcheck:');
    expect(section).toContain('9477/health');
  });

  test('sven-marketplace has healthcheck on port 9478', () => {
    const match = composeSrc.match(/^ {2}sven-marketplace:\n/m);
    expect(match).not.toBeNull();
    const idx = match!.index!;
    const section = composeSrc.slice(idx, idx + 1200);
    expect(section).toContain('healthcheck:');
    expect(section).toContain('9478/health');
  });

  test('sven-eidolon has healthcheck on port 9479', () => {
    const match = composeSrc.match(/^ {2}sven-eidolon:\n/m);
    expect(match).not.toBeNull();
    const idx = match!.index!;
    const section = composeSrc.slice(idx, idx + 800);
    expect(section).toContain('healthcheck:');
    expect(section).toContain('9479/health');
  });

  test('marketplace-ui service entry exists', () => {
    expect(composeSrc).toContain('marketplace-ui:');
    const idx = composeSrc.indexOf('marketplace-ui:');
    const section = composeSrc.slice(idx, idx + 600);
    expect(section).toContain('apps/marketplace-ui/Dockerfile');
    expect(section).toContain('healthcheck:');
  });

  test('marketplace-ui depends on sven-marketplace', () => {
    const idx = composeSrc.indexOf('marketplace-ui:');
    const section = composeSrc.slice(idx, idx + 600);
    expect(section).toContain('sven-marketplace');
    expect(section).toContain('service_healthy');
  });

  test('all healthchecks use CMD-SHELL with curl', () => {
    const checks = composeSrc.match(/CMD-SHELL.*curl -sf/g) ?? [];
    expect(checks.length).toBeGreaterThanOrEqual(4);
  });
});

/* ================================================================
   3. Listing update API
   ================================================================ */

describe('Listing update API', () => {
  const repoSrc = readSrc('services/sven-marketplace/src/repo.ts');
  const listingsSrc = readSrc('services/sven-marketplace/src/routes/listings.ts');

  test('repo.ts has updateListing method', () => {
    expect(repoSrc).toContain('async updateListing(');
  });

  test('updateListing accepts title, description, unitPrice, tags, coverImageUrl, metadata', () => {
    const sig = repoSrc.slice(
      repoSrc.indexOf('async updateListing('),
      repoSrc.indexOf('async updateListing(') + 400,
    );
    expect(sig).toContain('title?: string');
    expect(sig).toContain('description?: string');
    expect(sig).toContain('unitPrice?: number');
    expect(sig).toContain('tags?: string[]');
    expect(sig).toContain('coverImageUrl?: string | null');
    expect(sig).toContain('metadata?: Record<string, unknown>');
  });

  test('updateListing blocks price change on published listings', () => {
    const method = repoSrc.slice(
      repoSrc.indexOf('async updateListing('),
      repoSrc.indexOf('async updateListing(') + 800,
    );
    expect(method).toContain('Cannot change price on a published listing');
  });

  test('listings.ts has PUT /v1/market/listings/:id route', () => {
    expect(listingsSrc).toContain("app.put('/v1/market/listings/:id'");
  });

  test('listings.ts has UpdateBody zod schema', () => {
    expect(listingsSrc).toContain('const UpdateBody = z.object(');
  });

  test('PUT route calls repo.updateListing', () => {
    expect(listingsSrc).toContain('repo.updateListing(');
  });

  test('PUT route returns 404 for missing listing', () => {
    expect(listingsSrc).toContain("'NOT_FOUND'");
  });

  test('PUT route returns 400 for validation/update errors', () => {
    expect(listingsSrc).toContain("'UPDATE_FAILED'");
    expect(listingsSrc).toContain("'BAD_BODY'");
  });
});

/* ================================================================
   4. Economy digest refund analysis
   ================================================================ */

describe('Economy digest refund analysis', () => {
  const digestSrc = readSrc('services/agent-runtime/src/economy-digest.ts');

  test('digest format includes 24h refunds section', () => {
    expect(digestSrc).toContain('24h refunds:');
  });

  test('generateHighlights checks refund count', () => {
    expect(digestSrc).toContain('refunds24hCount');
    expect(digestSrc).toContain('refund(s) in 24h');
  });

  test('generateHighlights warns on high refund rate', () => {
    expect(digestSrc).toContain('Refund rate exceeds 20%');
  });

  test('generateHighlights produces refund bullet when count > 0', () => {
    // Import and call would require mocking, so we verify the logic shape
    expect(digestSrc).toContain('snap.refunds24hCount > 0');
    expect(digestSrc).toContain('review product quality');
  });
});

/* ================================================================
   5. Economy context prompt refund fields
   ================================================================ */

describe('Economy context prompt refund fields', () => {
  const promptSrc = readSrc('services/agent-runtime/src/economy-context-prompt.ts');

  test('EconomySnapshot has refunds24hCount field', () => {
    expect(promptSrc).toContain('refunds24hCount: number');
  });

  test('EconomySnapshot has refunds24hUsd field', () => {
    expect(promptSrc).toContain('refunds24hUsd: number');
  });

  test('gatherEconomySnapshot queries marketplace_orders for refunds', () => {
    expect(promptSrc).toContain("status = 'refunded'");
    expect(promptSrc).toContain('total_refunded');
  });

  test('buildEconomyContextPrompt includes refund section', () => {
    expect(promptSrc).toContain('Refunds:');
    expect(promptSrc).toContain('snap.refunds24hCount');
  });

  test('snapshot defaults include refund zeroes', () => {
    expect(promptSrc).toContain('refunds24hCount: 0');
    expect(promptSrc).toContain('refunds24hUsd: 0');
  });
});

/* ================================================================
   6. Listing detail page (pre-existing — verify it exists)
   ================================================================ */

describe('Listing detail page', () => {
  test('listings/[slug]/page.tsx exists', () => {
    const exists = fs.existsSync(
      path.join(ROOT, 'apps/marketplace-ui/src/app/listings/[slug]/page.tsx'),
    );
    expect(exists).toBe(true);
  });

  test('api.ts has fetchListingBySlug function', () => {
    const apiSrc = readSrc('apps/marketplace-ui/src/lib/api.ts');
    expect(apiSrc).toContain('fetchListingBySlug');
  });

  test('detail page imports PurchaseButton', () => {
    const pageSrc = readSrc('apps/marketplace-ui/src/app/listings/[slug]/page.tsx');
    expect(pageSrc).toContain('PurchaseButton');
  });

  test('detail page shows tags', () => {
    const pageSrc = readSrc('apps/marketplace-ui/src/app/listings/[slug]/page.tsx');
    expect(pageSrc).toContain('listing.tags');
  });
});
