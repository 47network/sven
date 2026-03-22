const DEFAULT_MCP_HTTP_MAX_RESPONSE_BYTES = 1024 * 1024;
const MIN_MCP_HTTP_MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_MCP_HTTP_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
]);
const BLOCKED_IP_LITERALS = new Set([
  '169.254.169.254',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
]);

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function isPrivateOrLocalIpv4(hostname: string): boolean {
  const octets = parseIpv4(hostname);
  if (!octets) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateOrLocalIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
  return false;
}

function isHostAllowlisted(hostname: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  return allowlist.some((entry) => {
    const normalized = entry.toLowerCase().trim();
    if (!normalized) return false;
    if (normalized === hostname) return true;
    if (normalized.startsWith('*.')) {
      const suffix = normalized.slice(1);
      return hostname.endsWith(suffix);
    }
    return false;
  });
}

function resolveMcpHttpHostAllowlist(raw: unknown): string[] {
  const text = String(raw || '').trim();
  if (!text) return [];
  return text.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function validateMcpHttpTargetUrl(urlRaw: string, allowlist: string[]): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlRaw);
  } catch {
    return { ok: false, error: 'MCP_HTTP_UNSAFE_TARGET: invalid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `MCP_HTTP_UNSAFE_TARGET: unsupported scheme ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (!hostname) {
    return { ok: false, error: 'MCP_HTTP_UNSAFE_TARGET: missing hostname' };
  }
  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_IP_LITERALS.has(hostname)) {
    return { ok: false, error: `MCP_HTTP_UNSAFE_TARGET: blocked host ${hostname}` };
  }
  if (isPrivateOrLocalIpv4(hostname) || isPrivateOrLocalIpv6(hostname)) {
    return { ok: false, error: `MCP_HTTP_UNSAFE_TARGET: private/local host ${hostname}` };
  }
  if (!isHostAllowlisted(hostname, allowlist)) {
    return { ok: false, error: `MCP_HTTP_UNSAFE_TARGET: host ${hostname} not allowlisted` };
  }

  return { ok: true, url: parsed };
}

export function resolveMcpHttpMaxResponseBytes(raw: unknown): number {
  return clampInt(
    raw,
    DEFAULT_MCP_HTTP_MAX_RESPONSE_BYTES,
    MIN_MCP_HTTP_MAX_RESPONSE_BYTES,
    MAX_MCP_HTTP_MAX_RESPONSE_BYTES,
  );
}

async function readResponseTextWithLimit(res: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(res.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`MCP_HTTP_RESPONSE_TOO_LARGE: content-length ${contentLength} exceeds ${maxBytes}`);
  }

  if (!res.body) {
    const text = await res.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error(`MCP_HTTP_RESPONSE_TOO_LARGE: response body exceeds ${maxBytes} bytes`);
    }
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error(`MCP_HTTP_RESPONSE_TOO_LARGE: response body exceeds ${maxBytes} bytes`);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function callMcpHttp(
  url: string,
  authToken: string,
  toolName: string,
  input: Record<string, unknown>,
  timeoutMs: number,
  deps: {
    fetchImpl?: typeof fetch;
    maxResponseBytes?: number;
  } = {},
): Promise<any> {
  const fetchImpl = deps.fetchImpl || fetch;
  const maxResponseBytes = deps.maxResponseBytes || resolveMcpHttpMaxResponseBytes(process.env.SVEN_MCP_HTTP_MAX_RESPONSE_BYTES);
  const hostAllowlist = resolveMcpHttpHostAllowlist(process.env.SVEN_MCP_HTTP_ALLOWED_HOSTS);
  const target = validateMcpHttpTargetUrl(url, hostAllowlist);
  if (!target.ok) {
    throw new Error(target.error);
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(target.url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `mcp_${Date.now()}`,
        method: 'tools/call',
        params: { name: toolName, arguments: input || {} },
      }),
      signal: controller.signal,
    });

    const raw = await readResponseTextWithLimit(res, maxResponseBytes);
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error('MCP_HTTP_INVALID_JSON: response body is not valid JSON');
    }
    if (!res.ok) {
      throw new Error(`MCP_HTTP_TOOL_FAILED: status ${res.status}`);
    }
    if (payload?.error) {
      throw new Error('MCP_HTTP_TOOL_FAILED');
    }
    return payload?.result || {};
  } finally {
    clearTimeout(timer);
  }
}
