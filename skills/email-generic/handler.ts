type InputPayload = {
  action: 'send' | 'search' | 'list';
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  query?: string;
  limit?: number;
};

function requireApiBase(): string {
  const base = process.env.EMAIL_API_BASE || '';
  if (!base) {
    throw new Error('EMAIL_API_BASE is required for email bridge operations');
  }
  return base.replace(/\/+$/, '');
}

function authHeaders(): Record<string, string> {
  const apiKey = process.env.EMAIL_API_KEY || '';
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  const base = requireApiBase();
  if (action === 'send') {
    if (!payload.to || payload.to.length === 0) {
      throw new Error('to is required for send');
    }
    const res = await fetch(`${base}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || undefined,
        to: payload.to,
        cc: payload.cc || [],
        bcc: payload.bcc || [],
        subject: payload.subject || '',
        body: payload.body || '',
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Email send failed (${res.status}): ${JSON.stringify(result)}`);
    }
    return { action, result };
  }

  if (action === 'search') {
    const res = await fetch(`${base}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({
        query: payload.query || '',
        limit: Math.max(1, Math.min(Number(payload.limit || 10), 50)),
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Email search failed (${res.status}): ${JSON.stringify(result)}`);
    }
    return { action, items: result.items || result.messages || [], result };
  }

  if (action === 'list') {
    const limit = Math.max(1, Math.min(Number(payload.limit || 10), 50));
    const res = await fetch(`${base}/inbox?limit=${encodeURIComponent(String(limit))}`, {
      method: 'GET',
      headers: {
        ...authHeaders(),
      },
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Email list failed (${res.status}): ${JSON.stringify(result)}`);
    }
    return { action, items: result.items || result.messages || [], result };
  }

  throw new Error(`Unsupported action: ${action}`);
}
