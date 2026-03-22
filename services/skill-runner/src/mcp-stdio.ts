function parseJsonObjectCandidate(raw: string): Record<string, unknown> | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isJsonRpcEnvelope(candidate: Record<string, unknown>): boolean {
  return String(candidate.jsonrpc || '') === '2.0';
}

export function parseMcpStdioResponse(stdout: string, requestId: string): Record<string, unknown> {
  const full = String(stdout || '');
  const lines = full
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error('MCP_STDIO_NO_RESPONSE');
  }

  const envelopes: Array<Record<string, unknown>> = [];
  for (const line of lines) {
    const candidate = parseJsonObjectCandidate(line);
    if (!candidate) continue;
    if (isJsonRpcEnvelope(candidate)) {
      envelopes.push(candidate);
    }
  }

  let selected = envelopes.find((entry) => String(entry.id || '') === requestId) || null;
  if (!selected) {
    const whole = parseJsonObjectCandidate(full.trim());
    if (whole && isJsonRpcEnvelope(whole) && String(whole.id || '') === requestId) {
      selected = whole;
    }
  }
  if (!selected) {
    throw new Error('MCP_STDIO_INVALID_JSON_RESPONSE');
  }
  if (selected.error) {
    throw new Error('MCP_STDIO_TOOL_FAILED');
  }
  return (selected.result as Record<string, unknown>) || {};
}

