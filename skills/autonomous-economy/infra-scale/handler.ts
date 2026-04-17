type Input = Record<string, unknown>;

function str(input: Input, key: string): string | undefined {
  const v = input[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function num(input: Input, key: string): number | undefined {
  const v = input[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export default async function handler(input: Input): Promise<Record<string, unknown>> {
  if (str(input, 'action') !== 'propose') {
    return { error: 'Unknown action. Use: propose' };
  }

  const orgId = str(input, 'orgId');
  const kind = str(input, 'kind');
  const targetResource = str(input, 'targetResource');
  const estimatedCostUsd = num(input, 'estimatedCostUsd');

  if (!orgId) return { error: 'orgId is required' };
  if (!kind || !['scale-up', 'scale-down', 'decommission'].includes(kind)) {
    return { error: 'kind must be scale-up | scale-down | decommission' };
  }
  if (!targetResource) return { error: 'targetResource is required' };
  if (estimatedCostUsd === undefined) return { error: 'estimatedCostUsd is required' };

  const adminApi = str(input, 'adminApi') ?? process.env.ADMIN_API ?? 'http://127.0.0.1:4000';
  const url = `${adminApi}/admin/infra/scale/proposals`;

  const body = {
    orgId,
    automatonId: str(input, 'automatonId') ?? null,
    kind,
    targetResource,
    estimatedCostUsd,
    justification: str(input, 'justification') ?? 'Automaton requested scale action',
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    if (!res.ok) return { error: `HTTP ${res.status}`, body: parsed };
    return { result: parsed };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(t);
  }
}
