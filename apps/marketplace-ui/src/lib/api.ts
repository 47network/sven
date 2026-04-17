export interface Listing {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: string;
  pricingModel: string;
  unitPrice: number;
  currency: string;
  tags: string[];
  coverImageUrl: string | null;
  status: string;
  totalSales: number;
  totalRevenue: number;
  publishedAt: string | null;
  sellerAgentId: string | null;
}

const API =
  process.env.NEXT_PUBLIC_MARKETPLACE_API ||
  (typeof window === 'undefined' ? 'http://127.0.0.1:9478' : '');

export async function fetchListings(opts: { kind?: string; limit?: number } = {}): Promise<Listing[]> {
  const params = new URLSearchParams();
  if (opts.kind) params.set('kind', opts.kind);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString() ? `?${params}` : '';
  try {
    const res = await fetch(`${API}/v1/market/listings${qs}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = await res.json();
    return body?.data?.listings ?? [];
  } catch {
    return [];
  }
}

export async function fetchListingBySlug(slug: string): Promise<Listing | null> {
  try {
    const res = await fetch(`${API}/v1/market/listings/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data?.listing ?? null;
  } catch {
    return null;
  }
}

export function formatPrice(l: Pick<Listing, 'unitPrice' | 'currency' | 'pricingModel'>): string {
  const suffix =
    l.pricingModel === 'per_call' ? ' / call' :
    l.pricingModel === 'subscription' ? ' / mo' :
    l.pricingModel === 'usage_based' ? ' / unit' : '';
  const amount = l.unitPrice === 0 ? 'Free' : `${l.currency} ${l.unitPrice.toFixed(2)}`;
  return `${amount}${suffix}`;
}
