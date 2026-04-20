// ---------------------------------------------------------------------------
// Batch 9 — Marketplace Checkout UI tests
// ---------------------------------------------------------------------------
// Validates: api.ts functions, PurchaseButton component structure,
// detail page wiring, success/cancel pages, changelog entries
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 9 — Marketplace Checkout UI', () => {
  // -------------------------------------------------------------------------
  // b9-checkout-api: api.ts has createOrder + createCheckoutSession
  // -------------------------------------------------------------------------
  describe('api.ts exports', () => {
    const apiSrc = fs.readFileSync(
      path.join(ROOT, 'apps/marketplace-ui/src/lib/api.ts'),
      'utf-8',
    );

    test('exports createOrder function', () => {
      expect(apiSrc).toContain('export async function createOrder(');
    });

    test('createOrder posts to /v1/market/orders', () => {
      expect(apiSrc).toContain('/v1/market/orders');
      expect(apiSrc).toContain("method: 'POST'");
    });

    test('createOrder sends listingId and paymentMethod', () => {
      expect(apiSrc).toContain('listingId');
      expect(apiSrc).toContain('paymentMethod');
    });

    test('exports createCheckoutSession function', () => {
      expect(apiSrc).toContain('export async function createCheckoutSession(');
    });

    test('createCheckoutSession posts to /v1/market/checkout', () => {
      expect(apiSrc).toContain('/v1/market/checkout');
    });

    test('createCheckoutSession sends orderId', () => {
      expect(apiSrc).toContain('orderId');
    });

    test('exports Order interface', () => {
      expect(apiSrc).toContain('export interface Order');
    });

    test('Order interface has required fields', () => {
      expect(apiSrc).toMatch(/id:\s*string/);
      expect(apiSrc).toMatch(/listingId:\s*string/);
      expect(apiSrc).toMatch(/status:\s*string/);
      expect(apiSrc).toMatch(/total:\s*number/);
    });
  });

  // -------------------------------------------------------------------------
  // b9-purchase-button: PurchaseButton client component
  // -------------------------------------------------------------------------
  describe('PurchaseButton component', () => {
    const btnSrc = fs.readFileSync(
      path.join(ROOT, 'apps/marketplace-ui/src/components/PurchaseButton.tsx'),
      'utf-8',
    );

    test('is a client component', () => {
      expect(btnSrc.startsWith("'use client'")).toBe(true);
    });

    test('imports createOrder and createCheckoutSession', () => {
      expect(btnSrc).toContain('createOrder');
      expect(btnSrc).toContain('createCheckoutSession');
    });

    test('exports PurchaseButton component', () => {
      expect(btnSrc).toContain('export function PurchaseButton');
    });

    test('handles loading state', () => {
      expect(btnSrc).toContain("'loading'");
      expect(btnSrc).toContain('Processing');
    });

    test('handles error state', () => {
      expect(btnSrc).toContain("'error'");
      expect(btnSrc).toContain('AlertCircle');
    });

    test('redirects to checkout URL on success', () => {
      expect(btnSrc).toContain('window.location.href = checkoutUrl');
    });

    test('handles free items differently', () => {
      expect(btnSrc).toContain('isFree');
      expect(btnSrc).toContain('Free');
    });

    test('accepts listing prop', () => {
      expect(btnSrc).toContain('listing: Listing');
    });
  });

  // -------------------------------------------------------------------------
  // b9-detail-page-wire: disabled button replaced with PurchaseButton
  // -------------------------------------------------------------------------
  describe('Listing detail page wiring', () => {
    const detailSrc = fs.readFileSync(
      path.join(ROOT, 'apps/marketplace-ui/src/app/listings/[slug]/page.tsx'),
      'utf-8',
    );

    test('imports PurchaseButton', () => {
      expect(detailSrc).toContain("import { PurchaseButton }");
    });

    test('renders PurchaseButton component', () => {
      expect(detailSrc).toContain('<PurchaseButton');
    });

    test('disabled placeholder button is removed', () => {
      expect(detailSrc).not.toContain('cursor-not-allowed');
      expect(detailSrc).not.toContain('Checkout launches in Batch 2.1');
    });

    test('passes listing prop to PurchaseButton', () => {
      expect(detailSrc).toContain('listing={listing}');
    });
  });

  // -------------------------------------------------------------------------
  // b9-success-page: /checkout/success
  // -------------------------------------------------------------------------
  describe('Checkout success page', () => {
    const successSrc = fs.readFileSync(
      path.join(ROOT, 'apps/marketplace-ui/src/app/checkout/success/page.tsx'),
      'utf-8',
    );

    test('exists and exports default component', () => {
      expect(successSrc).toContain('export default function');
    });

    test('shows confirmation message', () => {
      expect(successSrc).toContain('Payment confirmed');
    });

    test('links back to marketplace', () => {
      expect(successSrc).toContain('href="/"');
    });

    test('uses CheckCircle icon', () => {
      expect(successSrc).toContain('CheckCircle');
    });

    test('mentions receipt', () => {
      expect(successSrc).toContain('receipt');
    });
  });

  // -------------------------------------------------------------------------
  // b9-cancel-page: /checkout/cancel
  // -------------------------------------------------------------------------
  describe('Checkout cancel page', () => {
    const cancelSrc = fs.readFileSync(
      path.join(ROOT, 'apps/marketplace-ui/src/app/checkout/cancel/page.tsx'),
      'utf-8',
    );

    test('exists and exports default component', () => {
      expect(cancelSrc).toContain('export default function');
    });

    test('is a client component (uses onClick)', () => {
      expect(cancelSrc).toContain("'use client'");
    });

    test('shows cancellation message', () => {
      expect(cancelSrc).toContain('Payment cancelled');
    });

    test('offers retry option', () => {
      expect(cancelSrc).toContain('Try again');
    });

    test('links back to marketplace', () => {
      expect(cancelSrc).toContain('Back to marketplace');
    });

    test('confirms no charge was made', () => {
      expect(cancelSrc).toContain('No charge was made');
    });
  });

  // -------------------------------------------------------------------------
  // b9-changelog: economy entries in CHANGELOG.md
  // -------------------------------------------------------------------------
  describe('CHANGELOG economy entries', () => {
    const changelog = fs.readFileSync(
      path.join(ROOT, 'CHANGELOG.md'),
      'utf-8',
    );

    test('has Autonomous Economy section', () => {
      expect(changelog).toContain('Autonomous Economy');
    });

    test('mentions Treasury Service', () => {
      expect(changelog).toContain('Treasury Service');
    });

    test('mentions Marketplace Service', () => {
      expect(changelog).toContain('Marketplace Service');
    });

    test('mentions Eidolon 3D City', () => {
      expect(changelog).toContain('Eidolon 3D City');
    });

    test('mentions Automaton Lifecycle', () => {
      expect(changelog).toContain('Automaton Lifecycle');
    });

    test('mentions Stripe checkout', () => {
      expect(changelog).toContain('Stripe Checkout');
    });
  });
});
