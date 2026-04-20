type Input = Record<string, unknown>;

function str(input: Input, key: string): string | undefined {
  const v = input[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function num(input: Input, key: string): number | undefined {
  const v = input[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
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

export default async function handler(input: Input): Promise<Record<string, unknown>> {
  const action = str(input, 'action');
  const api = str(input, 'treasuryApi') ?? process.env.TREASURY_API ?? 'http://127.0.0.1:9477';

  if (action === 'get') {
    const accountId = str(input, 'accountId');
    if (!accountId) return { error: 'accountId is required for action=get' };
    const data = await fetchJson(`${api}/accounts/${encodeURIComponent(accountId)}`);
    return { result: data };
  }

  if (action === 'list-transactions') {
    const accountId = str(input, 'accountId');
    const orgId = str(input, 'orgId');
    const limit = num(input, 'limit') ?? 20;
    if (!accountId && !orgId) {
      return { error: 'accountId or orgId is required for action=list-transactions' };
    }
    const qs = new URLSearchParams();
    if (accountId) qs.set('accountId', accountId);
    if (orgId) qs.set('orgId', orgId);
    qs.set('limit', String(limit));
    const data = await fetchJson(`${api}/transactions?${qs.toString()}`);
    return { result: data };
  }

  return { error: 'Unknown action. Use: get | list-transactions' };
}
