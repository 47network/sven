type Input = Record<string, unknown>;

function str(input: Input, key: string): string | undefined {
  const v = input[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function num(input: Input, key: string): number | undefined {
  const v = input[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
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
  const api = str(input, 'treasuryApi') ?? process.env.TREASURY_API ?? 'http://127.0.0.1:9477';
  const amount = num(input, 'amount');
  const currency = str(input, 'currency') ?? 'USD';
  const kind = str(input, 'kind') ?? 'skill_transfer';
  const source = str(input, 'source') ?? 'treasury-transfer-skill';

  if (!amount) return { error: 'amount is required and must be > 0' };

  if (action === 'transfer') {
    const from = str(input, 'fromAccountId');
    const to = str(input, 'toAccountId');
    if (!from || !to) {
      return { error: 'transfer requires both fromAccountId and toAccountId' };
    }

    const debitResult = await postJson(`${api}/transactions`, {
      accountId: from,
      type: 'debit',
      amount,
      currency,
      kind,
      source: `${source}:transfer-to:${to}`,
    });

    if (debitResult && typeof debitResult === 'object' && 'error' in debitResult) {
      return { error: 'Debit failed', details: debitResult };
    }

    const creditResult = await postJson(`${api}/transactions`, {
      accountId: to,
      type: 'credit',
      amount,
      currency,
      kind,
      source: `${source}:transfer-from:${from}`,
    });

    return { result: { debit: debitResult, credit: creditResult } };
  }

  if (action === 'credit') {
    const to = str(input, 'toAccountId');
    if (!to) return { error: 'credit requires toAccountId' };
    const result = await postJson(`${api}/transactions`, {
      accountId: to,
      type: 'credit',
      amount,
      currency,
      kind,
      source,
    });
    return { result };
  }

  if (action === 'debit') {
    const from = str(input, 'fromAccountId');
    if (!from) return { error: 'debit requires fromAccountId' };
    const result = await postJson(`${api}/transactions`, {
      accountId: from,
      type: 'debit',
      amount,
      currency,
      kind,
      source,
    });
    return { result };
  }

  return { error: 'Unknown action. Use: transfer | credit | debit' };
}
