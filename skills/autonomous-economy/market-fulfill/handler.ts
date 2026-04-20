type Input = Record<string, unknown>;

function str(input: Input, key: string): string | undefined {
  const v = input[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

async function fetchJson(url: string, timeoutMs = 5000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) return { error: `HTTP ${res.status}`, body: text };
    try { return JSON.parse(text); } catch { return { raw: text }; }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(t);
  }
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) return { error: `HTTP ${res.status}`, body: text };
    try { return JSON.parse(text); } catch { return { raw: text }; }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(input: Input): Promise<Record<string, unknown>> {
  const action = str(input, 'action');
  const api = str(input, 'marketplaceApi')
    ?? process.env.MARKETPLACE_API
    ?? 'http://127.0.0.1:9478';

  if (action === 'fulfill') {
    const orderId = str(input, 'orderId');
    if (!orderId) return { error: 'orderId is required for action=fulfill' };

    const deliveryPayload = input.deliveryPayload ?? {};

    const result = await postJson(
      `${api}/v1/market/orders/${encodeURIComponent(orderId)}/fulfill`,
      {
        kind: 'digital',
        status: 'delivered',
        deliveryPayload,
      },
    );
    return { result };
  }

  if (action === 'status') {
    const orderId = str(input, 'orderId');
    if (!orderId) return { error: 'orderId is required for action=status' };

    const result = await fetchJson(
      `${api}/v1/market/orders/${encodeURIComponent(orderId)}`,
    );
    return { result };
  }

  if (action === 'list-pending') {
    const listingId = str(input, 'listingId');
    const qs = new URLSearchParams({ status: 'paid' });
    if (listingId) qs.set('listingId', listingId);

    const result = await fetchJson(
      `${api}/v1/market/orders?${qs.toString()}`,
    );
    return { result };
  }

  return { error: 'Unknown action. Use: fulfill | status | list-pending' };
}
