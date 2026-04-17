type Input = Record<string, unknown>;

function str(input: Input, key: string): string | undefined {
  const v = input[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

async function safeFetchJson(url: string, timeoutMs = 5000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(input: Input): Promise<Record<string, unknown>> {
  if (str(input, 'action') !== 'status') {
    return { error: 'Unknown action. Use: status' };
  }
  const orgId = str(input, 'orgId');
  if (!orgId) return { error: 'orgId is required' };

  const treasuryApi = str(input, 'treasuryApi') ?? process.env.TREASURY_API ?? 'http://127.0.0.1:9477';
  const marketplaceApi = str(input, 'marketplaceApi') ?? process.env.MARKETPLACE_API ?? 'http://127.0.0.1:9478';
  const eidolonApi = str(input, 'eidolonApi') ?? process.env.EIDOLON_API ?? 'http://127.0.0.1:9479';

  const enc = encodeURIComponent(orgId);
  const [accounts, listings, eidolon] = await Promise.all([
    safeFetchJson(`${treasuryApi}/accounts?orgId=${enc}`),
    safeFetchJson(`${marketplaceApi}/v1/market/org/${enc}/listings`),
    safeFetchJson(`${eidolonApi}/v1/eidolon/snapshot?orgId=${enc}`),
  ]);

  return {
    result: {
      orgId,
      treasury: accounts,
      marketplace: listings,
      eidolon,
      generatedAt: new Date().toISOString(),
    },
  };
}
